import type { ReadingOccurrence, ReadingTarget } from "../shared/learning";
import { fail } from "./http";

export function parseReadingAnnotations(source: string, vocabulary: Map<string, ReadingTarget>) {
  const occurrences: ReadingOccurrence[] = [];
  let text = "";
  let position = 0;
  for (const match of source.matchAll(/\[([^\[\]\r\n]+)\]\(([^()\s]+)\)/gu)) {
    const [annotation, surface, reference] = match;
    const word = vocabulary.get(reference);
    if (!word || surface !== surface.trim()) {
      fail(503, "AI returned an invalid vocabulary link. Please try again.");
    }
    text += source.slice(position, match.index);
    const start = text.length;
    text += surface;
    occurrences.push({ start, end: text.length, wordId: word.id });
    position = match.index + annotation.length;
  }
  text += source.slice(position);
  if (/[\[\]]/u.test(text) || (vocabulary.size > 0 && occurrences.length === 0)) {
    fail(503, "AI returned missing or malformed vocabulary links. Please try again.");
  }
  return { text, occurrences };
}
