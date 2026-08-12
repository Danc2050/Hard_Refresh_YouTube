// Options uses the SAME background route as popup: runtime.sendMessage({type:"runNow"})

const DEFAULTS = {
  pattern: "youtube\\.com",
  flags: "i",
  startTime: "22:00",
  endTime: "06:00",
};

const $ = (id) => document.getElementById(id);
const pat = $("pat"), flg = $("flg"), start = $("start"), end = $("end");
const status = $("status"), saveMsg = $("saveMsg");

function report(msg, ok = true) { status.textContent = msg; status.className = ok ? "ok" : "err"; }
const isValidTime = (s) => /^\d{2}:\d{2}$/.test(s);

async function load() {
  const s = await chrome.storage.local.get([
    "pattern", "flags", "startTime", "endTime", "time", "lastFlush",
  ]);
  pat.value = s.pattern || DEFAULTS.pattern;
  flg.value = s.flags || DEFAULTS.flags;

  // `time` was the pre-2.0 key for the start of the window
  const st = s.startTime || s.time || "";
  start.value = isValidTime(st) ? st : DEFAULTS.startTime;
  end.value = isValidTime(s.endTime || "") ? s.endTime : DEFAULTS.endTime;

  if (s.lastFlush) report(JSON.stringify(s.lastFlush, null, 2), !!s.lastFlush.ok);
  else report("No runs yet.");
}

$("save").addEventListener("click", async () => {
  const cfg = {
    pattern: pat.value || DEFAULTS.pattern,
    flags: flg.value || DEFAULTS.flags,
    startTime: isValidTime(start.value) ? start.value : DEFAULTS.startTime,
    endTime: isValidTime(end.value) ? end.value : DEFAULTS.endTime,
  };
  await chrome.storage.local.set(cfg);
  await chrome.storage.local.remove("time"); // drop the migrated key
  // Ask background to reschedule now (background also reacts to storage change)
  try { await chrome.runtime.sendMessage({ type: "reschedule" }); } catch {}
  saveMsg.textContent = "Saved";
  setTimeout(() => (saveMsg.textContent = ""), 1200);
});

let runNowLock = false;
$("runNow").addEventListener("click", () => {
  if (runNowLock) return;
  runNowLock = true;
  chrome.runtime.sendMessage({ type: "runNow" }, (resp) => {
    runNowLock = false;
    if (chrome.runtime.lastError) {
      report(`Error: ${chrome.runtime.lastError.message}`, false);
      return;
    }
    const out = resp?.result || resp || {};
    report(JSON.stringify(out, null, 2), !!out.ok);
  });
});

load();
