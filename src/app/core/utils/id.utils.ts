/**
 * Generate a unique ID using crypto.randomUUID() with a short prefix.
 * Simple, collision-resistant, and human-debuggable.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Current timestamp in epoch milliseconds.
 */
export function now(): number {
  return Date.now();
}
