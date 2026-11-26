/** A run of text and whether it matched a query token. */
export type Segment = { text: string; mark: boolean };

/**
 * Splits `text` into marked and unmarked runs for the query `tokens` (as `queryTokens` returns
 * them: lowercase a-z0-9). Matching is a case-insensitive literal `indexOf`, never a RegExp, so
 * no query can inject a pattern. Every occurrence of every token is marked; overlapping and
 * touching matches merge into one run. The result is data, not HTML: render the marked runs as
 * `<mark>` text, never through `dangerouslySetInnerHTML`.
 */
export function highlight(text: string, tokens: readonly string[]): Segment[] {
  if (text === "") return [];
  const lower = text.toLowerCase();
  // A few characters change length when lowercased; offsets would no longer line up, so skip the marks.
  if (lower.length !== text.length) return [{ text, mark: false }];

  const marked = new Array<boolean>(text.length).fill(false);
  for (const raw of tokens) {
    const token = raw.toLowerCase();
    if (token === "") continue;
    for (let at = lower.indexOf(token); at !== -1; at = lower.indexOf(token, at + 1)) {
      for (let i = at; i < at + token.length; i++) marked[i] = true;
    }
  }

  const out: Segment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marked[i] !== marked[start]) {
      out.push({ text: text.slice(start, i), mark: marked[start]! });
      start = i;
    }
  }
  return out;
}
