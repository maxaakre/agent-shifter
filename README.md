# Agent Shifter

A menu bar gear shifter for Claude Code models on macOS.

Press a hotkey in a Claude Code session and it types `/model <id>` for you.

## Gears

| Hotkey | Gear | Model |
|--------|------|-------|
| `⌃⌥1` | 1 | `claude-haiku-4-5-20251001` |
| `⌃⌥2` | 2 | `claude-sonnet-5-5` |
| `⌃⌥3` | 3 | `claude-opus-5-5` |
| `⌃⌥4` | 4 | `claude-fable-5-1` |

## Run

```bash
npm install
npm start
```

A `⚙` appears in the menu bar. It shows the last gear you shifted to.

## Permissions

The first shift needs **Accessibility** access.

- Open **System Settings → Privacy & Security → Accessibility**.
- Turn on the app that ran `npm start` (e.g. iTerm2 or Terminal). If macOS lists Electron, turn that on too.

## Config

Edit `~/.config/agent-shifter/config.json`, then click **Reload config** in the menu.

- `gears`: digit `1`–`9` → model id.
- `hotkeyPrefix`: Electron accelerator prefix, default `Control+Alt`.
- `allowedApps`: exact app process names that may receive typing.

## Limits

- Shift with an empty input line. Text already typed gets `/model …` added to it.
- If you run `/model` yourself, the menu bar gear will not know.
