import { toLatinDigits } from './digits';

// Password-free accounts: the app creates an account whose email and password
// both come from a random recovery code. Keeping the code is all she needs to
// get her data back on a new phone. No email is ever sent (.invalid domain).

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const LENGTH = 12;
const DOMAIN = 'codes.bouthaina.invalid';

export function newCode(): string {
  let code = '';
  while (code.length < LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      // 248 = 31 * 8: skipping higher bytes keeps every letter equally likely.
      if (b < 248 && code.length < LENGTH) code += ALPHABET[b % ALPHABET.length];
    }
  }
  return code;
}

/** Whatever she typed (spaces, dashes, lower case, Arabic digits) → the code. */
export function cleanCode(input: string): string {
  return toLatinDigits(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(code: string): boolean {
  return code.length === LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

export function codeEmail(code: string): string {
  return `${code.toLowerCase()}@${DOMAIN}`;
}

/** The recovery code of a password-free account, or null for an email account. */
export function codeOf(email: string | null | undefined): string | null {
  if (!email || !email.endsWith('@' + DOMAIN)) return null;
  return email.slice(0, -DOMAIN.length - 1).toUpperCase();
}
