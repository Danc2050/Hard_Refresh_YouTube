// Options uses the SAME background route as popup: runtime.sendMessage({type:"runNow", ...})

const DEFAULTS = { pattern: "youtube\\.com", flags: "i", time: "00:00" };
const $ = (id) => document.getElementById(id);
const pat = $("pat"), flg = $("flg"), tim = $("time");
const status = $("status"), saveMsg = $("saveMsg");

function report(msg, ok = true) { status.textContent = msg; status.className = ok ? "ok" : "err"; }
const isValidTime = (s) => /^\d{2}:\d{2}$/.test(s);

async function load() {
  const s = await chrome.storage.local.get(DEFAULTS);
  pat.value = s.pattern || DEFAULTS.pattern;
  flg.value = s.flags || DEFAULTS.flags;
  tim.value = isValidTime(s.time || "") ? s.time : DEFAULTS.time;

  const { lastFlush } = await chrome.storage.local.get("lastFlush");
  if (lastFlush) report(JSON.stringify(lastFlush, null, 2), !!lastFlush.ok);
  else report("No runs yet.");
}

$("save").addEventListener("click", async () => {
  const cfg = {
    pattern: pat.value || DEFAULTS.pattern,
    flags: flg.value || DEFAULTS.flags,
    time: isValidTime(tim.value) ? tim.value : DEFAULTS.time
  };
  await chrome.storage.local.set(cfg);
  // Ask background to reschedule now (background also reacts to storage change)
  try { await chrome.runtime.sendMessage({ type: "reschedule" }); } catch {}
  saveMsg.textContent = "Saved";
  setTimeout(() => (saveMsg.textContent = ""), 1200);
});

// Keep it simple: same call as popup → background → flush
let runNowLock = false;
$("runNow").addEventListener("click", () => {
  if (runNowLock) return;
  runNowLock = true;
  chrome.runtime.sendMessage(
    { type: "runNow", reloadPattern: pat.value, reloadFlags: flg.value },
    (resp) => {
      runNowLock = false;
      if (chrome.runtime.lastError) {
        report(`Error: ${chrome.runtime.lastError.message}`, false);
        return;
      }
      const out = resp?.result || resp || {};
      report(JSON.stringify(out, null, 2), !!out.ok);
    }
  );
});

load();
