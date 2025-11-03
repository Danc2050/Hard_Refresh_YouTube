// background.js (MV3, module)
// Offloads benchmarking to an offscreen doc, reloads tabs here, supports schedule + Run now.
// Requires permissions: ["storage","browsingData","alarms","tabs","offscreen"]

// ---------- Config ----------
const DEFAULTS = { time: "00:00", pattern: "youtube\\.com", flags: "i" };
const ALARM = "scheduledFlush";
const OFFSCREEN_URL = "offscreen.html"; // bundled with your extension

// Single-flight guard so flushes never overlap
let inflight = null;

// ---------- Helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getCfg() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return {
    time: s.time || DEFAULTS.time,
    pattern: s.pattern || DEFAULTS.pattern,
    flags: s.flags || DEFAULTS.flags,
  };
}

function nextAt(timeStr) {
  const [hh, mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return +d;
}

async function schedule() {
  const { time } = await getCfg();
  await chrome.alarms.clear(ALARM);
  chrome.alarms.create(ALARM, { when: nextAt(time) });
}

async function reloadMatchingTabs(pattern, flags) {
  let re;
  try { re = new RegExp(pattern, flags); }
  catch { re = /youtube\.com/i; }
  const tabs = await chrome.tabs.query({});
  let n = 0;
  for (const t of tabs) {
    if (t.url && re.test(t.url)) {
      try { await chrome.tabs.reload(t.id); n++; } catch {}
    }
  }
  return n;
}

// ---------- Offscreen plumbing ----------
async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument?.();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["IFRAME_SCRIPTING"],
      justification: "Isolate benchmarking API calls to avoid SW/options crash",
    });
  }
}

async function runFlushViaOffscreen() {
  // The offscreen page runs ONLY benchmarking calls (DNS clear + closeConnections),
  // then replies with a result object. It does NOT touch chrome.tabs.
  await ensureOffscreen();

  // We call it; it responds with { ok, usedBenchmarking, steps[], error? }
  const res = await chrome.runtime.sendMessage({ type: "offscreenFlush" })
    .catch(() => ({ ok: false, error: "offscreen messaging failed" }));

  // Close the offscreen doc as soon as we're done
  try { await chrome.offscreen.closeDocument(); } catch {}
  return res;
}

// ---------- Orchestrator (single entry point) ----------
async function flushAndReload(pattern, flags) {
  if (inflight) return inflight; // coalesce concurrent calls

  inflight = (async () => {
    // 1) Do the benchmarking-only flush in offscreen (may be no-op if flag missing)
    const benchRes = await runFlushViaOffscreen();

    // 2) Give Chrome a breath, then reload matching tabs here
    await sleep(150);
    const reloaded = await reloadMatchingTabs(pattern, flags);

    const combined = {
      ...benchRes,
      ok: benchRes?.ok !== false,
      reloaded,
      steps: [...(benchRes?.steps || []), `Reloaded ${reloaded} tab(s)`],
      at: new Date().toISOString(),
    };

    // Persist last result for Options page / debugging
    await chrome.storage.local.set({ lastFlush: combined });

    return combined;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

// ---------- Lifecycle ----------
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup?.addListener(async () => {
  // Make sure an alarm exists even if SW cold-starts
  await schedule();
});

// React to settings changes
chrome.storage.onChanged.addListener((chg, area) => {
  if (area === "local" && (chg.time || chg.pattern || chg.flags)) {
    schedule().catch(()=>{});
  }
});

// Alarm fires: run flush + reload, then reschedule next day
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== ALARM) return;
  const { pattern, flags } = await getCfg();
  await flushAndReload(pattern, flags);
  await schedule();
});

// Toolbar click → same path
chrome.action.onClicked.addListener(async () => {
  const { pattern, flags } = await getCfg();
  const res = await flushAndReload(pattern, flags);
  try {
    await chrome.action.setBadgeBackgroundColor({ color: res.ok ? [0,120,215,255] : [200,0,0,255] });
    await chrome.action.setBadgeText({ text: res.ok ? "OK" : "ERR" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1500);
  } catch {}
});

// Options/Popup → “Run now” + “Reschedule”
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "runNow") {
    // Uses the SAME route as popup: background → offscreen → reload tabs
    const p = msg.reloadPattern ?? DEFAULTS.pattern;
    const f = msg.reloadFlags ?? DEFAULTS.flags;
    flushAndReload(p, f).then((r) => sendResponse({ ok: true, result: r }));
    return true; // keep channel open for async response
  }
  if (msg?.type === "reschedule") {
    schedule().then(() => sendResponse({ ok: true }));
    return true;
  }
});
