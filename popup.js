import { flushDnsAndSockets } from "./flush.js";

const info = document.getElementById("information");
const runBtn = document.getElementById("run");

const DEFAULTS = { pattern: "youtube\\.com", flags: "i", redirectUrl: "http://192.168.68.67:8080/" };

function render(message, ok, widthEm = 28) {
  info.textContent = message;
  info.style.minWidth = widthEm + "em";
  info.className = ok ? "ok" : "err";
}

runBtn.addEventListener("click", async () => {
  render("Running…", true);
  const { pattern, flags, redirectUrl } = await chrome.storage.local.get(DEFAULTS);
  const res = await flushDnsAndSockets({ reloadPattern: pattern || DEFAULTS.pattern, reloadFlags: flags || DEFAULTS.flags, redirectUrl });
  if (res.ok) {
    render(
      `DNS resolver cache flushed and sockets closed.\n` +
      `• ${res.steps.join("\n• ")}\n` +
      `• ${redirectUrl ? `Redirected to ${redirectUrl}` : "Reloaded"}: ${res.reloaded} tab(s)`,
      true, 36
    );
  } else {
    render(res.error || "Failed to flush.", false, 36);
  }
});
