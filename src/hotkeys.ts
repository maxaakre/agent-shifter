import { GearMap } from "./gears";

export type Register = (accelerator: string, callback: () => void) => boolean;

export function registerGearHotkeys(
  gears: GearMap,
  prefix: string,
  register: Register,
  onGear: (gear: string) => void,
): string[] {
  const failed: string[] = [];
  for (const gear of Object.keys(gears).sort()) {
    const accelerator = `${prefix}+${gear}`;
    try {
      // Electron returns false if taken, throws if the accelerator is invalid.
      if (!register(accelerator, () => onGear(gear))) failed.push(accelerator);
    } catch {
      failed.push(accelerator);
    }
  }
  return failed;
}
