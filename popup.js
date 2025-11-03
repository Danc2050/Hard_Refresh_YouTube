import { flushDnsAndSockets } from "./flush.js";

const info = document.getElementById("information");
const runBtn = document.getElementById("run");

const DEFAULTS = { pattern: "youtube\\.com", flags: "i" };

function render(message, ok, widthEm = 28) {
  info.textContent = message;
  info.style.minWidth = widthEm + "em";
  info.className = ok ? "ok" : "err";
}

runBtn.addEventListener("click", async () => {
  render("Running…", true);
  const { pattern, flags } = await chrome.storage.local.get(DEFAULTS);
  const res = await flushDnsAndSockets({ reloadPattern: pattern || DEFAULTS.pattern, reloadFlags: flags || DEFAULTS.flags });
  if (res.ok) {
    render(
      `DNS resolver cache flushed and sockets closed.\n` +
      `• ${res.steps.join("\n• ")}\n` +
      `• Reloaded: ${res.reloaded} tab(s)`,
      true, 36
    );
  } else {
    render(res.error || "Failed to flush.", false, 36);
  }
});
