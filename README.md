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
| `⌃⌥0` | — | Turn the shifter on / off |

## Run

```bash
npm install
npm start
```

A `⚙` appears in the menu bar. It shows the last gear you shifted to.

## Skip the "switch model?" question (recommended)

While a conversation is fresh, Claude Code asks you to confirm a model switch. That would stop the shifter halfway.

Install a small hook once:

```bash
npm run install-hook
```

- It adds a `PreModelSwitch` hook to `~/.claude/settings.json`, and keeps a backup at `settings.json.bak`.
- It **only** skips the question for switches the shifter made. When you type `/model` yourself, you still get asked.
- To remove it: `npm run uninstall-hook`.
- The hook runs `dist/allow-hook.js`, so keep the project built (`npm start` builds it).

**Why Claude Code asks:** each model has its own prompt cache. After a switch, the next request re-reads the whole conversation without the cache, which costs more in long sessions.

## Turn it on and off

- Click **Shifter on** in the menu, or press `⌃⌥0`.
- When off, the menu bar shows `⚙ off` and the gear hotkeys are released, so other apps can use them.
- `⌃⌥0` still works while off, so you can turn it back on.
- It starts **on** each time you launch it.

## How it works

1. You press a gear hotkey, e.g. `⌃⌥2`.
2. The app asks macOS which app is **focused**.
3. If it is not an allowed terminal (iTerm2, Terminal, nodeterm), it stops and shows "Not a terminal".
4. It **waits until you let go** of ⌃⌥, so the typed keys are not read as shortcuts.
5. It **checks the focused app again**, in case focus moved while waiting.
6. It leaves a short note (`~/.config/agent-shifter/pending.json`) so the hook knows this switch is ours.
7. It types `/model claude-sonnet-5-5` and presses Return, like you typed it yourself.
8. The menu bar updates to `⚙ 2`.

Under the hood:

- **Electron** gives the menu bar icon and the global hotkeys.
- **`osascript`** (macOS scripting) finds the focused app and sends the keystrokes through System Events. That is why it needs Accessibility access.
- The app never talks to Claude Code directly. It only types, so it works in any terminal on the allowed list.

| File | Job |
|------|-----|
| `src/main.ts` | Menu bar, hotkeys, notifications |
| `src/shifter.ts` | Decides whether to shift, then types the command |
| `src/typer.ts` | The keystroke script (waits for keys, re-checks focus) |
| `src/frontmost.ts` | Finds the focused app |
| `src/toggle.ts` | On/off state |
| `src/hotkeys.ts` | Registers the hotkeys |
| `src/config.ts` | Loads and checks the config file |
| `src/messages.ts` | Turns errors into notification text |
| `src/pending.ts` | The short-lived "this switch is ours" note |
| `src/allow-hook.ts` | The `PreModelSwitch` hook that skips the question |
| `src/install-hook.ts` | Adds/removes the hook in `~/.claude/settings.json` |

## Permissions

The first shift needs **Accessibility** access.

- Open **System Settings → Privacy & Security → Accessibility**.
- Turn on the app that ran `npm start` (e.g. iTerm2 or Terminal). If macOS lists Electron, turn that on too.

## Config

Edit `~/.config/agent-shifter/config.json`, then click **Reload config** in the menu.

- `gears`: digit `1`–`9` → model id.
- `hotkeyPrefix`: Electron accelerator prefix, default `Control+Alt`. The toggle is `<prefix>+0`.
- `allowedApps`: exact app process names that may receive typing.

## Test

```bash
npm test
```

## Limits

- Shift with an empty input line. Text already typed gets `/model …` added to it.
- If you run `/model` yourself, the menu bar gear will not know.
- `/model <id>` also becomes your default model for new Claude Code sessions.
