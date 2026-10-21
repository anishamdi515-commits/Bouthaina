export function uid(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  return Date.now().toString(36) + Array.from(rnd, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}
