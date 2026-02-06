/**
 * Client-side content filter for profanity detection and filtering
 * Provides instant feedback to users before content reaches the backend
 */

// Common Turkish and English bad words (lightweight list)
const BAD_WORDS_TR = [
  'amk', 'aq', 'orospu', 'piç', 'siktir', 'göt', 'yarrak', 'amcık', 'sikik',
  'gerizekalı', 'salak', 'aptal', 'mal', 'dangalak', 'ebem', 'ananı'
];

const BAD_WORDS_EN = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap',
  'dick', 'pussy', 'cock', 'idiot', 'stupid', 'dumb', 'moron'
];

// Combine all bad words
const ALL_BAD_WORDS = [...BAD_WORDS_TR, ...BAD_WORDS_EN];

/**
 * Creates a regex pattern for a word that matches whole words only
 * @param word - The word to create pattern for
 * @returns RegExp pattern
 */
function createWordPattern(word: string): RegExp {
  // Match whole words with word boundaries, case insensitive
  // Also handles repeated characters (e.g., "fuuuck" matches "fuck")
  const expandedWord = word.split('').join('+');
  return new RegExp(`\\b${expandedWord}\\b`, 'gi');
}

/**
 * Filters profanity from text by replacing bad words with asterisks
 * @param text - The text to filter
 * @returns Filtered text with bad words replaced by asterisks
 */
export function filterText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  let filtered = text;
  
  // Replace each bad word with asterisks
  ALL_BAD_WORDS.forEach(badWord => {
    const pattern = createWordPattern(badWord);
    filtered = filtered.replace(pattern, (match) => {
      // Replace with same length of asterisks
      return '*'.repeat(match.length);
    });
  });
  
  return filtered;
}

/**
 * Checks if text contains profanity
 * @param text - The text to check
 * @returns true if profanity is detected
 */
export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  return ALL_BAD_WORDS.some(badWord => {
    const pattern = createWordPattern(badWord);
    return pattern.test(text);
  });
}

/**
 * Returns a sanitized version of text and whether it was modified
 * @param text - The text to sanitize
 * @returns Object with sanitized text and hasProfanity flag
 */
export function sanitizeText(text: string): { 
  sanitized: string; 
  hasProfanity: boolean;
  originalLength: number;
  filteredLength: number;
} {
  const sanitized = filterText(text);
  const hasProfanity = sanitized !== text;
  
  return {
    sanitized,
    hasProfanity,
    originalLength: text.length,
    filteredLength: sanitized.length
  };
}

/**
 * Gets a list of detected bad words in the text
 * @param text - The text to analyze
 * @returns Array of detected bad words
 */
export function getDetectedWords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  const detected: string[] = [];
  
  ALL_BAD_WORDS.forEach(badWord => {
    const pattern = createWordPattern(badWord);
    if (pattern.test(text)) {
      detected.push(badWord);
    }
  });
  
  return [...new Set(detected)]; // Remove duplicates
}
