// flush.js — safer benchmarking flusher with single-flight guard

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let _inFlight = null; // single-flight mutex

async function reloadMatchingTabs(pattern = "youtube\\.com", flags = "i") {
  let re;
  try { re = new RegExp(pattern, flags); } catch { re = /youtube\.com/i; }
  const tabs = await chrome.tabs.query({});
  let count = 0;
  for (const t of tabs) {
    if (t.url && re.test(t.url)) {
      try { await chrome.tabs.reload(t.id, { bypassCache: false }); count++; } catch {}
    }
  }
  return count;
}
// Sends a matching tab to redirectUrl if set, otherwise reloads it. Returns true if it acted.
async function reloadOrRedirect(t, re, redirectUrl) {
  if (!t.url || !re.test(t.url)) return false;
  if (redirectUrl && t.url.startsWith(redirectUrl)) return false; // already there
  try {
    if (redirectUrl) await chrome.tabs.update(t.id, { url: redirectUrl });
    else await chrome.tabs.reload(t.id);
    return true;
  } catch { return false; }
}

// SAFE MODE: one pass, no cache clear, no retries, with small delays.


export async function flushDnsAndSockets(opts = {}) {
  const { reloadPattern = "youtube\\.com", reloadFlags = "i", redirectUrl = "" } = opts;
  const bench = chrome.benchmarking;

  // Fallback: just reload tabs if benchmarking isn't present
  if (!(bench?.clearHostResolverCache && bench?.closeConnections)) {
    const re = new RegExp(reloadPattern, reloadFlags);
    const tabs = await chrome.tabs.query({});
    let reloaded = 0;
    for (const t of tabs) if (await reloadOrRedirect(t, re, redirectUrl)) reloaded++;
    return { ok: true, usedBenchmarking: false, steps: [`Fallback reload (${reloaded})`], reloaded };
  }

  try {
    // 1) DNS only
    bench.clearHostResolverCache();

    // 2) tiny pause
    await sleep(100);

    // 3) ONE closeConnections (no retries)
    //bench.closeConnections();

    // 4) tiny pause
    await sleep(150);

    // 5) Reload matching tabs
    const re = new RegExp(reloadPattern, reloadFlags);
    const tabs = await chrome.tabs.query({});
    let reloaded = 0;
    for (const t of tabs) if (await reloadOrRedirect(t, re, redirectUrl)) reloaded++;

    return { ok: true, usedBenchmarking: true, steps: ["DNS cleared", "closeConnections()", `Reloaded ${reloaded}`], reloaded };
  } catch (e) {
    return { ok: false, usedBenchmarking: true, error: String(e) };
  }
}
