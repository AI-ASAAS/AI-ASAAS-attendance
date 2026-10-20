/**
 * Thmanyah's calligraphic features, applied the way its aesthetics guide asks:
 *  - Swash ("الأحرف المرسلة"): only on a word's final letter, once per heading,
 *    never on two neighbouring words.
 *  - Extended fatha ("الفتحة الممتدة"): a fatha over N kashidas, drawn by
 *    stylistic set ss0(N+2) — the set number follows the kashida count.
 */

/** Letters the font ships swash forms for. */
const SWASH_LETTERS = new Set('ئبتثسشصضفقكمنىيٮٯپڡں');
const TRAILING_MARKS = /[ً-ْٰ]$/; // harakat after the letter

/** Index of the letter that can carry the swash at the end of `text`, or -1. */
export function swashIndex(text: string): number {
  let end = text.trimEnd().length;
  while (end > 0 && TRAILING_MARKS.test(text.slice(0, end))) end--;
  // "شيء": the hamza does not join, so the swash goes on the letter before it.
  if (text[end - 1] === 'ء') end--;
  const index = end - 1;
  return index >= 0 && SWASH_LETTERS.has(text[index]!) ? index : -1;
}

/** Text whose final letter takes its swash form when the font allows it. */
export function Swash({ children }: { children: string }) {
  const index = swashIndex(children);
  if (index < 0) return <>{children}</>;
  return (
    <>
      {children.slice(0, index)}
      <span className="swash">{children[index]}</span>
      {children.slice(index + 1)}
    </>
  );
}

interface StretchProps {
  /** Text before the stretched letter, e.g. "صب". */
  before: string;
  /** Text after the stretch, e.g. "اح". */
  after: string;
  /** Kashidas under the long fatha (1–5). */
  length?: 1 | 2 | 3 | 4 | 5;
}

/** A word with an extended fatha drawn over kashidas: صبَــاح. */
export function Stretch({ before, after, length = 2 }: StretchProps) {
  return (
    <span className="stretch" style={{ fontFeatureSettings: `'ss0${length + 2}'` }}>
      {before}
      {'َ'}
      {'ـ'.repeat(length)}
      {after}
    </span>
  );
}
