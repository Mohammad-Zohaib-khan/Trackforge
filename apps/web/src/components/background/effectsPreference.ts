import { useSyncExternalStore } from 'react';

/**
 * Per-device visual preference (animated background on/off). This is a display
 * convenience, not account data, so it lives in localStorage and is wrapped in
 * try/catch for browsers that block storage.
 */
export type EffectsSetting = 'on' | 'off';
const KEY = 'trackforge:effects';
const listeners = new Set<() => void>();

function read(): EffectsSetting {
  try {
    return window.localStorage.getItem(KEY) === 'off' ? 'off' : 'on';
  } catch {
    return 'on';
  }
}

function write(value: EffectsSetting): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable: the choice applies for this page view only */
  }
  current = value;
  listeners.forEach((l) => l());
}

let current: EffectsSetting | null = null;

function snapshot(): EffectsSetting {
  current ??= read();
  return current;
}

export function useEffectsPreference(): [EffectsSetting, (v: EffectsSetting) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => 'on' as const,
  );
  return [value, write];
}
