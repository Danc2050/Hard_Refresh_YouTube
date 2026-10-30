// background.js (MV3, module)
// Blocks YouTube during a nightly window with declarativeNetRequest, and reloads
// only the tabs matching your regex. No DNS flush, no socket closing, and no
// --enable-net-benchmarking: the block happens inside Chrome's network stack, so
// cached DNS entries and already-open sockets are irrelevant.
//
// Requires permissions: ["storage","alarms","tabs","declarativeNetRequest"]

// ---------- Config ----------
const DEFAULTS = {
  startTime: "22:00", // block turns on
  endTime: "06:00",   // block turns off
  pattern: "youtube\\.com",
  flags: "i",
};

const RULESET = "block";      // must match the id in manifest.json
const ALARM_ON = "blockOn";
const ALARM_OFF = "blockOff";
const ALARM_TICK = "reconcile";
const TICK_MINUTES = 5;

// Single-flight guard so runs never overlap
let inflight = null;

// ---------- Helpers ----------
async function getCfg() {
  const s = await chrome.storage.local.get([
    "startTime", "endTime", "pattern", "flags", "time",
  ]);
  return {
    // `time` was the pre-2.0 key for the start of the window
    startTime: s.startTime || s.time || DEFAULTS.startTime,
    endTime: s.endTime || DEFAULTS.endTime,
    pattern: s.pattern || DEFAULTS.pattern,
    flags: s.flags || DEFAULTS.flags,
  };
}

const toMinutes = (t) => {
  const [hh, mm] = String(t).split(":").map(Number);
  return ((hh || 0) % 24) * 60 + ((mm || 0) % 60);
};

// Handles windows that wrap past midnight, e.g. 22:00 -> 06:00
function inWindow(startTime, endTime, now = new Date()) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMinutes(startTime);
  const e = toMinutes(endTime);
  if (s === e) return false; // zero-length window: never block
  return s < e ? (cur >= s && cur < e) : (cur >= s || cur < e);
}

function nextAt(timeStr) {
  const [hh, mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return +d;
}

// ---------- Blocking ----------
// Returns true if this call actually changed the state.
async function setBlocking(on) {
  const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  const isOn = enabled.includes(RULESET);
  if (isOn === on) return false;
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    on ? { enableRulesetIds: [RULESET] } : { disableRulesetIds: [RULESET] }
  );
  return true;
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

// ---------- Orchestrator (single entry point) ----------
// force: block regardless of the schedule (used by "Run now")
async function enforce({ force = false } = {}) {
  if (inflight) return inflight; // coalesce concurrent calls

  inflight = (async () => {
    const cfg = await getCfg();
    const shouldBlock = force || inWindow(cfg.startTime, cfg.endTime);
    const changed = await setBlocking(shouldBlock);

    // Only disturb tabs on the transition into the window (or a manual run).
    // Reloading a YouTube tab while the ruleset is live redirects it to the
    // bedtime page (see rules.json), which discards whatever was already buffered. Without this
    // the tab would keep playing until the buffer drained.
    let reloaded = 0;
    if (shouldBlock && (changed || force)) {
      reloaded = await reloadMatchingTabs(cfg.pattern, cfg.flags);
    }

    const result = {
      ok: true,
      blocking: shouldBlock,
      changed,
      reloaded,
      window: `${cfg.startTime}-${cfg.endTime}`,
      steps: [
        shouldBlock ? "Blocking ruleset enabled" : "Blocking ruleset disabled",
        `Reloaded ${reloaded} tab(s)`,
      ],
      at: new Date().toISOString(),
    };

    // Persist last result for the Options page / debugging
    await chrome.storage.local.set({ lastFlush: result });
    return result;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

// ---------- Scheduling ----------
async function schedule() {
  const { startTime, endTime } = await getCfg();
  await chrome.alarms.clear(ALARM_ON);
  await chrome.alarms.clear(ALARM_OFF);
  chrome.alarms.create(ALARM_ON, { when: nextAt(startTime) });
  chrome.alarms.create(ALARM_OFF, { when: nextAt(endTime) });
  // Safety net: if the machine was asleep across a boundary or an alarm was
  // missed, this puts the state right within TICK_MINUTES.
  chrome.alarms.create(ALARM_TICK, { periodInMinutes: TICK_MINUTES });
}

async function init() {
  await schedule();
  await enforce();
}

// ---------- Lifecycle ----------
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup?.addListener(init);

// React to settings changes
chrome.storage.onChanged.addListener((chg, area) => {
  if (area !== "local") return;
  if (chg.startTime || chg.endTime || chg.pattern || chg.flags || chg.time) {
    schedule().then(() => enforce()).catch(() => {});
  }
});

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === ALARM_TICK) {
    await enforce();
    return;
  }
  if (a.name !== ALARM_ON && a.name !== ALARM_OFF) return;
  await enforce();
  await schedule(); // re-arm one-shot alarms (also keeps DST honest)
});

// Options/Popup -> "Run now" + "Reschedule"
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "runNow") {
    // Forces the block on so you can verify it works outside the window.
    // The reconcile tick will restore the scheduled state within TICK_MINUTES.
    enforce({ force: true }).then((r) => sendResponse({ ok: true, result: r }));
    return true; // keep channel open for async response
  }
  if (msg?.type === "reschedule") {
    schedule().then(() => enforce()).then(() => sendResponse({ ok: true }));
    return true;
  }
});
