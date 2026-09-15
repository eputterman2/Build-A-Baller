const MAX_SUMMARY_WORDS = 24;

function normalizeFeedback(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/([!?.,])\1+/g, '$1')
    .trim();
}

export function isUsefulFeedback(value: string): boolean {
  const normalized = normalizeFeedback(value).toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (/^(ok|okay|thanks|thank you|hi|hello|test|testing|lol|n\/a|none|nothing|works)[!. ]*$/i.test(normalized)) {
    return false;
  }
  if (!/[a-z]/i.test(normalized)) return false;
  if (new Set(words).size === 1) return false;
  return true;
}

function summaryLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (/(bug|error|broken|not work|can't|cannot|missing|crop|blurry|issue|problem|crash|fail)/.test(normalized)) {
    return 'Issue';
  }
  if (/(add|change|make|would like|wish|could|please|want|move|fix|improve|should)/.test(normalized)) {
    return 'Suggestion';
  }
  if (/(love|like|great|awesome|perfect|good|thank)/.test(normalized)) {
    return 'Positive note';
  }
  return 'Feedback';
}

export function summarizeFeedback(value: string): string {
  const normalized = normalizeFeedback(value);
  const firstThought = normalized.split(/[.!?](?:\s|$)/)[0] || normalized;
  const withoutFiller = firstThought.replace(
    /^(i think|i feel|just wanted to say|can you|could you|please|i would like|i want to)\s+/i,
    '',
  );
  const words = withoutFiller.split(/\s+/).filter(Boolean);
  const clipped = words.slice(0, MAX_SUMMARY_WORDS).join(' ');
  const suffix = words.length > MAX_SUMMARY_WORDS ? '...' : '';
  const body = `${clipped}${suffix}`.replace(/^[a-z]/, character => character.toUpperCase());
  return `${summaryLabel(normalized)}: ${body}`;
}
