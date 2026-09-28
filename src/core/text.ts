/** Whitespace- and quote-insensitive form used to check that a model's quote really appears in the source. */
export const normalise = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
