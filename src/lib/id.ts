export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `table-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
