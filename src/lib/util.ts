export function uid(prefix = ''): string {
  const r = Math.random().toString(36).slice(2, 8);
  return prefix + Date.now().toString(36) + r;
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}
const PALETTE = ['#2B5BE3', '#16733F', '#B45309', '#7C3AED', '#C42F33', '#0E7490', '#9D174D', '#4D7C0F'];
export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
export function matches(hay: string, needle: string): boolean {
  return normalize(hay).includes(normalize(needle.trim()));
}
