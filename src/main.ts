import { Menu, Notification, Tray, app, globalShortcut, nativeImage } from "electron";
import { loadConfig } from "./config";
import { createFrontmost } from "./frontmost";
import { Config } from "./gears";
import { registerGearHotkeys } from "./hotkeys";
import { describeResult } from "./messages";
import { Shifter, createShifter } from "./shifter";
import { createTyper } from "./typer";

let tray: Tray | null = null;
let config: Config;
let shifter: Shifter;

function notify(body: string): void {
  new Notification({ title: "Agent Shifter", body }).show();
}

function refreshTray(): void {
  if (!tray) return;
  const current = shifter.current();
  tray.setTitle(`⚙ ${current ?? "–"}`);
  const gearItems = Object.keys(config.gears)
    .sort()
    .map((gear) => ({
      label: `${gear}  ${config.gears[gear]}`,
      type: "radio" as const,
      checked: gear === current,
      click: () => void doShift(gear),
    }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
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
  const failed = registerGearHotkeys(
    config.gears,
    config.hotkeyPrefix,
    (accelerator, callback) => globalShortcut.register(accelerator, callback),
    (gear) => void doShift(gear),
  );

  if (loaded.warning) notify(loaded.warning);
  for (const accelerator of failed) notify(`Hotkey unavailable: ${accelerator}`);
  refreshTray();
}

app.whenReady().then(async () => {
  app.dock?.hide(); // menu bar only, no Dock icon
  tray = new Tray(nativeImage.createEmpty());
  await setup();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
