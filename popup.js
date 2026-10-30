// Popup now uses the same background route as the options page.
// (flush.js is gone; blocking lives in declarativeNetRequest.)

const info = document.getElementById("information");
const runBtn = document.getElementById("run");

function render(message, ok, widthEm = 28) {
  info.textContent = message;
  info.style.minWidth = widthEm + "em";
  info.className = ok ? "ok" : "err";
}

runBtn.addEventListener("click", () => {
  render("Running…", true);
  chrome.runtime.sendMessage({ type: "runNow" }, (resp) => {
    if (chrome.runtime.lastError) {
      render(chrome.runtime.lastError.message, false, 36);
      return;
    }
    const res = resp?.result;
    if (!res?.ok) {
      render(res?.error || "Failed.", false, 36);
      return;
    }
    render(
      `YouTube blocked (window ${res.window}).\n` +
      `• ${res.steps.join("\n• ")}`,
      true, 36
    );
  });
});
