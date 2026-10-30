// Options uses the SAME background route as popup: runtime.sendMessage({type:"runNow", ...})

const DEFAULTS = { pattern: "youtube\\.com", flags: "i", time: "00:00", redirectUrl: "http://192.168.68.67:8080/" };
const $ = (id) => document.getElementById(id);
const pat = $("pat"), flg = $("flg"), tim = $("time"), redir = $("redir");
const status = $("status"), saveMsg = $("saveMsg");

function report(msg, ok = true) { status.textContent = msg; status.className = ok ? "ok" : "err"; }
const isValidTime = (s) => /^\d{2}:\d{2}$/.test(s);
// "" (no redirect) or an http(s) URL
function isValidRedirect(s) {
  if (!s) return true;
  try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; }
}

async function load() {
  const s = await chrome.storage.local.get(DEFAULTS);
  pat.value = s.pattern || DEFAULTS.pattern;
  flg.value = s.flags || DEFAULTS.flags;
  tim.value = isValidTime(s.time || "") ? s.time : DEFAULTS.time;
  redir.value = s.redirectUrl ?? DEFAULTS.redirectUrl;

  const { lastFlush } = await chrome.storage.local.get("lastFlush");
  if (lastFlush) report(JSON.stringify(lastFlush, null, 2), !!lastFlush.ok);
  else report("No runs yet.");
}

$("save").addEventListener("click", async () => {
  const redirectUrl = redir.value.trim();
  if (!isValidRedirect(redirectUrl)) {
    saveMsg.textContent = "Redirect URL must start with http:// or https://";
    saveMsg.className = "err";
    return;
  }
  saveMsg.className = "ok";
  const cfg = {
    redirectUrl,
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
    { type: "runNow", reloadPattern: pat.value, reloadFlags: flg.value, redirectUrl: isValidRedirect(redir.value.trim()) ? redir.value.trim() : "" },
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
