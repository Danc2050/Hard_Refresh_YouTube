// offscreen.js — run *only* the benchmarking calls here

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function flushOnly() {
  const bench = chrome.benchmarking;
  if (!(bench?.clearHostResolverCache && bench?.closeConnections)) {
    return { ok: false, usedBenchmarking: false, error: "Benchmarking API unavailable (need --enable-net-benchmarking)" };
  }
  try {
    // conservative sequence to avoid crashes
    bench.clearHostResolverCache();
    await sleep(100);
    bench.closeConnections();   // single call
    await sleep(150);

    return { ok: true, usedBenchmarking: true, steps: ["DNS cleared","closeConnections()"] };
  } catch (e) {
    return { ok: false, usedBenchmarking: true, error: String(e) };
  }
}

// listen for background's request, return benchmarking-only result
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "offscreenFlush") {
    flushOnly().then(res => sendResponse(res));
    return true; // async
  }
});
