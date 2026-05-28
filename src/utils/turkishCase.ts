const LOWERCASE_MAP: Record<string, string> = {
  'I': 'ı',
  'İ': 'i',
};

const UPPERCASE_MAP: Record<string, string> = {
  'i': 'İ',
  'ı': 'I',
};

function turkishLower(char: string): string {
  if (LOWERCASE_MAP[char]) return LOWERCASE_MAP[char];
  return char.toLocaleLowerCase('tr');
}

function turkishUpper(char: string): string {
  if (UPPERCASE_MAP[char]) return UPPERCASE_MAP[char];
  return char.toLocaleUpperCase('tr');
}

export function toTurkishTitleCase(text: string): string {
  if (!text) return text;
  return text
    .split(/(\s+)/)
    .map((segment) => {
      if (/^\s+$/.test(segment)) return segment;
      if (/^\d/.test(segment)) return segment;
      const chars = Array.from(segment);
      return [turkishUpper(chars[0]), ...chars.slice(1).map(turkishLower)].join('');
    })
    .join('');
}
