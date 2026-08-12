# YouTube Night Block (Schedule + Regex)

A Chrome/Edge extension that blocks YouTube during a nightly window and reloads
only the tabs matching a regex, leaving the rest of the browser untouched.

## Purpose

Blocking YouTube at the DNS layer (Pi-hole, AdGuard Home, NextDNS) has two gaps:
an already-open tab keeps playing from its buffer and its existing connections,
and Chrome's Secure DNS can bypass the resolver entirely.

This extension closes both gaps on the machine itself. Blocking happens inside
Chrome's network stack via `declarativeNetRequest`, so cached DNS entries and
open sockets are irrelevant, and the schedule is enforced by the extension rather
than by browser policy (which refreshes too slowly to hit a precise bedtime).

## How it works

At the start of the window the extension enables a `declarativeNetRequest`
ruleset covering `youtube.com`, `youtu.be`, `youtube-nocookie.com`,
`googlevideo.com`, and `youtubei.googleapis.com`. Blocking `googlevideo.com` as a
`media`/`xmlhttprequest` resource is what actually stops playback — that is the
video CDN, and it is the piece Chrome's `URLBlocklist` policy cannot reach.

It then reloads tabs matching your regex, which lands them on Chrome's block page
and discards anything already buffered. No other tabs are touched.

At the end of the window the ruleset is disabled and no tabs are disturbed.

## Features

- **Scheduled window**: block from one time until another, wrapping past midnight
- **Surgical tab reset**: only tabs matching your regex are reloaded, and only on
  the transition into the window
- **Self-healing**: a 5-minute reconcile alarm fixes the state if the machine was
  asleep across a boundary or an alarm was missed
- **Manual trigger**: the popup and options page force the block on for testing

## Configuration

Open the extension's options page:

- **Regex pattern** / **flags** — which tabs get reloaded, e.g. `youtube\.com`, `i`
- **Block from** / **until** — the nightly window, e.g. `22:00` to `06:00`

## Requirements

None beyond a Chromium browser. There is no command-line flag to set: earlier
versions required `--enable-net-benchmarking` for DNS flushing and socket
closing, which is no longer used.

### Permissions

- `declarativeNetRequest` — block requests while the window is active
- `tabs` — find and reload tabs matching the pattern
- `storage` — save configuration
- `alarms` — schedule the window boundaries

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Making it stick

Loaded unpacked, the extension can be disabled from `chrome://extensions` in two
clicks. To prevent that, force-install it via the `ExtensionInstallForcelist`
policy, which greys out the disable and remove buttons. On Windows, force-installing
an extension from outside the Chrome Web Store requires the machine to be joined to
Active Directory or Azure AD, or enrolled in Chrome Enterprise Core — so on a
standalone PC the practical route is publishing it unlisted to the Web Store and
force-installing by ID.

Worth pairing with the `DnsOverHttpsMode` policy set to `off`, so Chrome's Secure
DNS cannot bypass any network-level blocking you run alongside this.

## Recommended pairing

This covers one browser on one machine. For phones, tablets, and TVs, run a
network-level blocker (Pi-hole, AdGuard Home, or NextDNS) on the same schedule,
and make sure it blocks `*.googlevideo.com` rather than just `youtube.com`.
