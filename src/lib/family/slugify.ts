// Serbian Latin → ASCII map. NFKD decomposes most diacritics (č→c+̌, ć→c+́, etc.)
// so we strip them via the combining-mark regex, but Đ/đ are a separate letter
// (LATIN CAPITAL LETTER D WITH STROKE) that does not decompose. Map it manually
// so "Đorđević" produces "djordjevic" instead of "or-evic".
const SERBIAN_LETTER_MAP: Record<string, string> = {
  Đ: 'DJ',
  đ: 'dj',
};

// Convert a human family name into a URL-safe slug.
//
// Used both for `families.slug` and as the human-readable prefix of invite tokens
// (e.g. `djordjevic-X3kP9q`). Pure function — no DB lookup for uniqueness; the
// caller (createFamily / createInvite) is responsible for collision handling via
// the existing `unique` constraint on `families.slug`.
export function slugify(input: string): string {
  return input
    .replace(/[Đđ]/g, (c) => SERBIAN_LETTER_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48); // cap so the final token stays well under URL length limits
}
