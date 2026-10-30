# Tab Refresher (Regex + Schedule)

A Chrome/Edge browser extension that automatically flushes DNS cache, closes network sockets, and reloads browser tabs matching a regex pattern on a configurable daily schedule.

## Purpose

This extension is designed to maintain fresh network connections and reload specific tabs automatically. It's particularly useful for:

- Preventing stale DNS cache issues by clearing the resolver cache
- Forcing network connection refreshes by closing existing sockets
- Automatically reloading specific tabs (e.g., monitoring dashboards, live streams) on a schedule
- Refreshing tabs that require daily updates or re-authentication

## Features

### Core Functionality
- **DNS Flush**: Clears Chrome's DNS resolver cache
- **Socket Management**: Closes all open network connections
- **Smart Tab Reload**: Reloads only tabs matching a customizable regex pattern
- **Redirect**: Optionally sends matching tabs to a URL (e.g. a bedtime page) instead of reloading them
- **Scheduled Execution**: Runs automatically at a configured time (e.g., midnight)
- **Manual Trigger**: Click the toolbar icon or use the popup/options page to run immediately

### Configuration Options
- **Regex Pattern**: Define which tabs to reload (e.g., `youtube\.com`)
- **Regex Flags**: Customize matching behavior (e.g., `i` for case-insensitive)
- **Schedule Time**: Set when the daily flush should occur (default: 00:00)
- **Redirect URL**: Where matching tabs are sent (default: `http://192.168.68.67:8080/`). Leave empty to reload instead

## Requirements

### Mandatory
To enable the full DNS flush and socket closing functionality, Chrome/Edge must be launched with the benchmarking flag:

```bash
# Chrome
chrome.exe --enable-net-benchmarking

# Edge
msedge.exe --enable-net-benchmarking
```

**Note**: Without this flag, the extension will still reload matching tabs but cannot flush DNS or close sockets.

### Permissions
The extension requires the following permissions:
- `tabs` - Query and reload browser tabs
- `storage` - Save configuration settings
- `browsingData` - Clear browsing data
- `alarms` - Schedule periodic execution
- `offscreen` - Isolate benchmarking API calls
- `<all_urls>` - Access all tab URLs for pattern matching

## Installation

1. Clone or download this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Launch Chrome/Edge with `--enable-net-benchmarking` flag for full functionality

## Usage

### Initial Setup
1. Click the extension icon in the toolbar, or right-click and select "Options"
2. Configure your regex pattern (e.g., `youtube\.com` to match YouTube tabs)
3. Set regex flags (typically `i` for case-insensitive matching)
4. Choose the daily run time (24-hour format, e.g., 00:00 for midnight)
5. Set the redirect URL, or clear it to just reload matching tabs
6. Click "Save"

### Manual Execution
- **Toolbar Click**: Click the extension icon to run immediately
- **Options Page**: Open the Options page and click "Run now"
- **Popup**: Click the extension, then click "Flush now"

After manual execution, the toolbar icon will display a badge:
- Green "OK" - Successful execution
- Red "ERR" - Error occurred

### Monitoring
The Options page displays the last run status, including:
- Timestamp of execution
- DNS flush status
- Number of tabs reloaded
- Any error messages

## Architecture

The extension uses a service worker architecture (Manifest V3):

- **background.js** - Orchestrates scheduling, tab reloading, and offscreen communication
- **offscreen.js** - Handles DNS flush and socket closing via Chrome's benchmarking API
- **popup.js** - Provides quick manual execution interface
- **options.js** - Configuration UI for patterns and schedule
- **flush.js** - Utility functions for flush operations

The offscreen document pattern prevents the service worker from crashing when using the benchmarking API.

## Default Configuration

- **Time**: 00:00 (midnight)
- **Pattern**: `youtube\.com`
- **Flags**: `i` (case-insensitive)
- **Redirect URL**: `http://192.168.68.67:8080/`

## Limitations

- Requires `--enable-net-benchmarking` flag for DNS flush functionality
- Only reloads tabs that match the configured regex pattern
- Scheduled execution runs once per day at the specified time
- Cannot reload certain protected Chrome pages (e.g., `chrome://` URLs)

## Troubleshooting

**Extension runs but doesn't flush DNS:**
- Ensure Chrome/Edge is launched with `--enable-net-benchmarking` flag
- Check the Options page "Last run" section for error messages

**Tabs aren't reloading:**
- Verify your regex pattern is correct
- Test the pattern at https://regex101.com/
- Check the "Last run" section to see how many tabs were matched

**Scheduled execution isn't working:**
- Make sure Chrome/Edge is running at the scheduled time
- Check that the alarm is set correctly in the Options page
- Service workers may be terminated; the alarm should wake it up

## Version

Current version: 1.1.0

## License

This project does not currently specify a license.
