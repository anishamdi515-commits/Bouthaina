// Arabic keyboards (iPhone especially) type ٠١٢٣ instead of 0123. They look the
// same to a person but are different characters to the login server.

const ARABIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

export function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (c) => String(Math.max(ARABIC.indexOf(c), PERSIAN.indexOf(c))));
}

export function toArabicDigits(s: string): string {
  return s.replace(/[0-9]/g, (c) => ARABIC[Number(c)]);
}

/** The password as typed first, then its digit variants (without duplicates). */
export function passwordVariants(p: string): string[] {
  return [...new Set([p, toLatinDigits(p), toArabicDigits(toLatinDigits(p))])];
}

export function normalizeEmail(e: string): string {
  return toLatinDigits(e).trim().toLowerCase();
}
