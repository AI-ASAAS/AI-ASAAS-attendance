import { kitText } from './i18n';

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

/** The level's name in the page language ("Very weak" to "Strong"). */
export const strengthLabel = (level: StrengthLevel) => kitText(`strength${level}`);

const COMMON = ['password', 'qwerty', 'asaas', 'admin', '123456', 'abc123', 'iloveyou', '000000', '111111'];
const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** Has a run of `length` consecutive characters from a keyboard/alphabet/number sequence. */
function hasSequence(password: string, length = 4): boolean {
  const lower = password.toLowerCase();
  return SEQUENCES.some((seq) => {
    for (let i = 0; i + length <= seq.length; i++) {
      const run = seq.slice(i, i + length);
      if (lower.includes(run) || lower.includes([...run].reverse().join(''))) return true;
    }
    return false;
  });
}

/**
 * A guidance-only estimate (no composition rules are enforced): length counts
 * most, variety helps, and predictable patterns pull the score down.
 */
export function passwordStrength(password: string): StrengthLevel {
  if (!password) return 0;
  const lower = password.toLowerCase();
  if (COMMON.some((word) => lower.includes(word)) || /^(.)\1+$/.test(password)) return 0;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[؀-ۿ]/, /[^\w؀-ۿ]/].filter((re) => re.test(password));
  if (kinds.length >= 3) score++;
  if (kinds.length <= 1 && password.length < 14) score--;
  if (hasSequence(password) || /(.)\1{2,}/.test(password)) score--;

  return Math.max(0, Math.min(4, score)) as StrengthLevel;
}
