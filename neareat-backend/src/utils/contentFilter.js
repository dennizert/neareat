// Content moderation: detects offensive Turkish/English words in user-generated text.
// Returns true if the text contains prohibited content.

const OFFENSIVE_WORDS = new Set([
  // ── Turkish slang / insults ──────────────────────────────────────────────────
  'amk', 'amına', 'amını', 'amcık', 'amcığına',
  'bok', 'boktan', 'bok gibi',
  'göt', 'götü', 'götveren',
  'ibne',
  'orospu', 'orospuçocuğu', 'orospu çocuğu',
  'piç', 'piçlik', 'piçler',
  'sik', 'sikim', 'sikerim', 'sikeyim', 'siktir', 'siktiririm', 'sik git',
  'yarrak', 'yarrağı',
  'kahpe', 'kahpece', 'kaltak',
  'puşt', 'puştluk',
  'gavat',
  'sürtük',
  'fahişe', 'fahişelik',
  'gerzek',
  'gerizekalı',
  'yavşak',
  'şerefsiz', 'şerefsizin', 'şerefsizler',
  'namussuz', 'namussuzun',
  'ahlaksız', 'ahlaksızlık',
  'pezevenk', 'pezevengin',
  'kevaşe',
  'oç', 'oçak',
  'döl',
  'embesil',
  'dangalak',
  'salak', // generic but often abusive in context

  // ── English profanity ────────────────────────────────────────────────────────
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckoff',
  'shit', 'bullshit',
  'asshole', 'ass hole',
  'bitch', 'bitches',
  'bastard',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'nigger', 'nigga',
  'faggot', 'fag',
  'retard', 'retarded',
  'motherfucker', 'motherfucking',
]);

// Compound phrases that should always be rejected (checked via substring, not word boundary)
const OFFENSIVE_PHRASES = [
  'orospu çocuğu',
  'orospuçocuğu',
  'amına koyayım',
  'amına koy',
  'siktir git',
  'defol git',
  'son of a bitch',
  'fuck you',
  'fuck off',
];

/**
 * Normalise a single token for comparison.
 * Maps Turkish letters to ASCII equivalents so that variants like
 * "şerefsiz" / "şerefs1z" / "serefsiz" all resolve to the same form.
 */
function normalizeTr(str) {
  return str
    .toLowerCase()
    .replace(/[ğ]/g, 'g')
    .replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[â]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[û]/g, 'u')
    // Common leetspeak substitutions
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/\*/g, '')
    .replace(/-/g, '')
    // Uzatılmış yazımları daralt: "fuuuck" / "siktiiir" → "fuck" / "siktir"
    .replace(/(.)\1{2,}/g, '$1');
}

/**
 * Returns true when the text contains offensive content.
 * @param {string} text
 * @returns {boolean}
 */
function containsOffensiveContent(text) {
  if (!text || typeof text !== 'string') return false;

  const lower = text.toLowerCase().trim();

  // 1. Phrase-level check (before tokenizing) — metni de normalize et ki Türkçe
  // karakter/leetspeak varyantları ("orospu çocuğu", "s1ktir git") da yakalansın.
  const normalizedText = normalizeTr(lower);
  if (OFFENSIVE_PHRASES.some(phrase => normalizedText.includes(normalizeTr(phrase)))) return true;

  // 2. Token-level check — split on whitespace and punctuation
  // Not: karakter sınıfı içinde `[` ve `/` escape gerektirmez, ama `]` GEREKTİRİR —
  // escape'siz bir `]` sınıfı erken kapatır ve regex'in anlamını tamamen değiştirir.
  const tokens = lower.split(/[\s.,!?;:'"()[\]{}\-_/\\|+=#@&%^~`]+/).filter(Boolean);
  for (const token of tokens) {
    const norm = normalizeTr(token);
    if (OFFENSIVE_WORDS.has(norm)) return true;
    // Also check the original token against the set
    if (OFFENSIVE_WORDS.has(token)) return true;
    // Check if token STARTS WITH a root offensive word (handles Turkish suffixes)
    for (const word of OFFENSIVE_WORDS) {
      if (norm.startsWith(normalizeTr(word)) && norm.length <= word.length + 6) {
        return true;
      }
    }
  }

  return false;
}

module.exports = { containsOffensiveContent };
