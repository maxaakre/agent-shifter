# Agent Shifter — Design (v1: manual gears)

Date: 2026-09-30

## Goal

A macOS menu bar app that switches the model of a running Claude Code session,
like a gear stick. Press a hotkey or click a gear, and the focused Claude Code
session changes model.

## What the user asked for

- A visual widget to switch models in a Claude Code window.
- Both manual gears and an automatic mode ("D"). Auto mode is part 2 and is
  out of scope for this spec.
- Written in TypeScript.
- Must work in iTerm2, macOS Terminal, and Nodeterm.

## Assumptions

- The user shifts the window they are looking at (the focused window).
- The Claude Code input line is empty when shifting.
- Personal use: app size (~100 MB for Electron) is acceptable.

## Success criteria

- Pressing `⌃⌥1`–`⌃⌥4` in a focused Claude Code session in iTerm2, Terminal,
  or Nodeterm changes the session's model to the mapped model.
- Pressing a hotkey while a non-allowed app is focused types nothing.
- The tray shows the last gear shifted to.

## Gears

| Gear | Model ID                    | Use for                 |
|------|-----------------------------|-------------------------|
| 1    | `claude-haiku-4-5-20251001` | Quick, cheap edits      |
| 2    | `claude-sonnet-5-5`         | Everyday coding         |
| 3    | `claude-opus-5-5`           | Hard problems, planning |
| 4    | `claude-fable-5-1`          | Hardest tasks           |

Full model IDs are used instead of aliases so meaning does not change over time.

## Architecture

**Stack:** Electron + TypeScript. Electron provides the tray icon and global
hotkeys. Keystrokes and focused-app detection use macOS `osascript`
(AppleScript via System Events), called from Node with `execFile`. No native
add-ons.

### How a shift works

1. User presses `⌃⌥<n>` or clicks gear `<n>` in the tray menu.
2. The app asks macOS for the name of the frontmost process.
3. If the name is not in `allowedApps`: do not type. Show a notification
   "Not a terminal: <app name>".
4. If allowed: type `/model <model-id>` then press Return.
5. Update the tray title to the gear number (e.g. `⚙ 2`) and tick that gear
   in the menu.

Note: clicking a gear in the tray menu must not make the app itself frontmost.
The tray menu closes before the shift runs, so focus returns to the terminal.
The implementation must verify this in the manual check.

### Modules

| Module         | Responsibility                                                    | Depends on          |
|----------------|-------------------------------------------------------------------|---------------------|
| `gears.ts`     | Default gear table and types. Pure data.                          | —                   |
| `config.ts`    | Load/validate `~/.config/agent-shifter/config.json`; write defaults on first run; fall back to defaults if invalid. | `gears.ts` |
| `frontmost.ts` | Return the frontmost process name.                                | `osascript`         |
| `typer.ts`     | Type a string and press Return in the frontmost window.           | `osascript`         |
| `shifter.ts`   | Shift logic: check app, type command, return result. No Electron. | injected frontmost, typer |
| `main.ts`      | Electron glue: tray, menu, hotkeys, notifications.                | all of the above    |

`shifter.ts` receives `frontmost` and `typer` as parameters so it can be
tested with fakes. It returns a result object
(`{ ok: true, gear } | { ok: false, reason }`); `main.ts` turns that into
notifications and tray updates.

## Config

Path: `~/.config/agent-shifter/config.json`. Written with defaults on first run.

```json
{
  "gears": {
    "1": "claude-haiku-4-5-20251001",
    "2": "claude-sonnet-5-5",
    "3": "claude-opus-5-5",
    "4": "claude-fable-5-1"
  },
  "hotkeyPrefix": "Control+Alt",
  "allowedApps": ["iTerm2", "Terminal", "nodeterm"]
}
```

- Gear keys are single digits `1`–`9`. Hotkey for gear `n` is
  `<hotkeyPrefix>+<n>` (Electron accelerator format).
- `allowedApps` matches the System Events process name exactly.
- Config is read once at startup. Changes need an app restart (a "Reload
  config" menu item is included for convenience).

## Error handling

| Case                              | Behaviour                                                        |
|-----------------------------------|------------------------------------------------------------------|
| Focused app not allowed           | Type nothing. Notification: "Not a terminal: <app>".             |
| No Accessibility permission       | `osascript` fails. Notification with steps to grant permission in System Settings → Privacy & Security → Accessibility. |
| Config file missing               | Write defaults and use them.                                     |
| Config file invalid JSON / schema | Use defaults. Notification: "Config invalid, using defaults".    |
| Hotkey already taken by another app | Log it, notification naming the hotkey. Other gears still work. |

## Known limits (v1)

- Tray state can drift if the user runs `/model` manually. Tray shows the last
  gear this app shifted to.
- If the input line has text, `/model ...` is appended to it.
- One gear state for all windows; no per-tab tracking.

## Testing

- **Unit (Vitest):** `shifter.ts` (allowed app, blocked app, typer error,
  unknown gear) and `config.ts` (missing file, invalid file, valid file) with
  fakes and a temp directory. No real keystrokes in tests.
- **Manual:** shift gears 1–4 in iTerm2, Terminal, and Nodeterm; confirm
  Claude Code reports the new model. Press a hotkey with a non-terminal
  focused and confirm nothing is typed. Click a gear in the tray menu and
  confirm it shifts the terminal, not the app.

## Out of scope

- Auto mode ("D"): separate design.
- Showing the gear in Claude Code's status line.
- Windows/Linux support.
- Packaging/signing a distributable `.app`. v1 runs via `npm start`.
