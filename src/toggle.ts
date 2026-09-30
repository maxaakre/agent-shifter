export interface ToggleDeps {
  register: () => string[]; // registers gear hotkeys, returns failed accelerators
  unregister: () => void; // releases gear hotkeys
  initial?: boolean;
}

export interface Toggle {
  isOn(): boolean;
  set(on: boolean): string[];
  toggle(): string[];
}

export function createToggle(deps: ToggleDeps): Toggle {
  let on = deps.initial ?? true;

  function set(next: boolean): string[] {
    if (next === on) return [];
    on = next;
    if (on) return deps.register();
    deps.unregister();
    return [];
  }

  return { isOn: () => on, set, toggle: () => set(!on) };
}
