import { Menu, Notification, Tray, app, globalShortcut, nativeImage } from "electron";
import { loadConfig } from "./config";
import { createFrontmost } from "./frontmost";
import { Config } from "./gears";
import { gearAccelerators, registerGearHotkeys, toggleAccelerator } from "./hotkeys";
import { describeResult } from "./messages";
import { Shifter, createShifter } from "./shifter";
import { Toggle, createToggle } from "./toggle";
import { createTyper } from "./typer";

let tray: Tray | null = null;
let config: Config;
let shifter: Shifter;
let toggle: Toggle;

function notify(body: string): void {
  new Notification({ title: "Agent Shifter", body }).show();
}

function refreshTray(): void {
  if (!tray) return;
  const current = shifter.current();
  const on = toggle.isOn();
  tray.setTitle(on ? `⚙ ${current ?? "–"}` : "⚙ off");
  const gearItems = Object.keys(config.gears)
    .sort()
    .map((gear) => ({
      label: `${gear}  ${config.gears[gear]}`,
      type: "radio" as const,
      checked: gear === current,
      enabled: on,
      click: () => void doShift(gear),
    }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Shifter on", type: "checkbox", checked: on, click: () => doToggle() },
      { type: "separator" },
      ...gearItems,
      { type: "separator" },
      { label: "Reload config", click: () => void setup() },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

async function doShift(gear: string): Promise<void> {
  const result = await shifter.shift(gear);
  const message = describeResult(result);
  if (message) notify(message);
  refreshTray();
}

function notifyFailed(failed: string[]): void {
  for (const accelerator of failed) notify(`Hotkey unavailable: ${accelerator}`);
}

function doToggle(): void {
  notifyFailed(toggle.toggle());
  refreshTray();
}

function registerGears(): string[] {
  return registerGearHotkeys(
    config.gears,
    config.hotkeyPrefix,
    (accelerator, callback) => globalShortcut.register(accelerator, callback),
    (gear) => void doShift(gear),
  );
}

function unregisterGears(): void {
  for (const accelerator of gearAccelerators(config.gears, config.hotkeyPrefix)) {
    try {
      globalShortcut.unregister(accelerator);
    } catch {
      // Invalid accelerators were never registered.
    }
  }
}

async function setup(): Promise<void> {
  const loaded = await loadConfig();
  config = loaded.config;
  // Keep the shown gear across a config reload.
  const previous = shifter?.current() ?? null;
  shifter = createShifter({
    config,
    frontmost: createFrontmost(),
    type: createTyper(),
    initialGear: previous && config.gears[previous] ? previous : null,
  });

  globalShortcut.unregisterAll();
  // Keep on/off across a config reload. The toggle hotkey stays registered while off.
  const wasOn = toggle?.isOn() ?? true;
  toggle = createToggle({ register: registerGears, unregister: unregisterGears, initial: wasOn });
  const failed = wasOn ? registerGears() : [];
  const toggleKey = toggleAccelerator(config.hotkeyPrefix);
  try {
    if (!globalShortcut.register(toggleKey, doToggle)) failed.push(toggleKey);
  } catch {
    failed.push(toggleKey);
  }

  if (loaded.warning) notify(loaded.warning);
  notifyFailed(failed);
  refreshTray();
}

app.whenReady().then(async () => {
  app.dock?.hide(); // menu bar only, no Dock icon
  tray = new Tray(nativeImage.createEmpty());
  await setup();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
