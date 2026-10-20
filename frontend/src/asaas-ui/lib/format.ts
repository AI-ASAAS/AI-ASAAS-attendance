const number = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('ar-YE-u-nu-latn', { notation: 'compact', maximumFractionDigits: 1 });
const monthYear = new Intl.DateTimeFormat('ar-YE-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('ar-YE-u-nu-latn', { month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('ar-YE-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Change for a site that is not in Yemeni rials. */
export const CURRENCY = 'ر.ي';

// Numbers are wrapped in Unicode LTR isolates so signs stay attached inside RTL text.
const isolate = (text: string) => `⁦${text}⁩`;

export const formatNumber = (value: number) => isolate(number.format(value));
export const formatSigned = (value: number, direction: 'in' | 'out') =>
  value === 0 ? isolate('0') : isolate(`${direction === 'in' ? '+' : '−'}${number.format(value)}`);

/** "أيوب" from "أيوب عبدالله الحطامي": greetings use the first name only. */
export const firstName = (displayName: string) => displayName.trim().split(/\s+/)[0] ?? '';
export const formatMoney = (value: number) => `${formatNumber(value)} ${CURRENCY}`;
export const formatCompact = (value: number) => compact.format(value);

const utc = (period: string) => new Date(`${period}-01T00:00:00Z`);
export const formatPeriod = (period: string) => monthYear.format(utc(period));
export const formatMonthShort = (period: string) => monthShort.format(utc(period));
export const formatDate = (date: string) => fullDate.format(new Date(`${date}T00:00:00Z`));

/** First letters of the first two names; a zero-width non-joiner keeps Arabic letters apart. */
export function initials(name: string): string {
  // Skip the definite article so "الأمل" contributes "أ", not "ا".
  const [first = '', second = ''] = name
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/^ال(?=..)/, ''));
  return [first[0], second[0]].filter(Boolean).join('‌');
}
