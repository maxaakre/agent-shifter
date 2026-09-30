import { GearMap } from "./gears";

export type Register = (accelerator: string, callback: () => void) => boolean;

export function gearAccelerators(gears: GearMap, prefix: string): string[] {
  return Object.keys(gears)
    .sort()
    .map((gear) => `${prefix}+${gear}`);
}

// Gears use 1-9, so 0 is free for the on/off toggle.
export function toggleAccelerator(prefix: string): string {
  return `${prefix}+0`;
}

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
