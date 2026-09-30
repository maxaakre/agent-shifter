export type GearMap = Record<string, string>;

export interface Config {
  gears: GearMap;
  hotkeyPrefix: string;
  allowedApps: string[];
}

export const DEFAULT_CONFIG: Config = {
  gears: {
    "1": "claude-haiku-4-5-20251001",
    "2": "claude-sonnet-5-5",
    "3": "claude-opus-5-5",
    "4": "claude-fable-5-1",
  },
  hotkeyPrefix: "Control+Alt",
  allowedApps: ["iTerm2", "Terminal", "nodeterm"],
};
