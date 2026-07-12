// Lightweight input guards so numeric / phone fields can't accept letters.
// These sanitize as-you-type (used in onChange) — they never throw, they just
// strip anything that doesn't belong.

// Digits only — for whole-number fields like weight (kg / g) and quantity.
export function keepDigits(value: string): string {
  return value.replace(/[^\d]/g, '')
}

// Digits plus a single decimal point — for money fields (price, discount, COD).
export function keepDecimal(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  // keep the first dot, drop any later ones
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
}

// Phone characters — digits and the punctuation real numbers use (+, -, spaces,
// parentheses, slash for a second number). Strips letters and everything else.
export function keepPhone(value: string): string {
  return value.replace(/[^\d+\-() /]/g, '')
}
