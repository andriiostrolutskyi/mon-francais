import { fsrs, Grades, TypeConvert } from "ts-fsrs";
import type { Card, CardInput } from "ts-fsrs";

export const scheduler = fsrs({ request_retention: 0.9 });
export function serializeCard(card: Card) {
  return JSON.stringify({ ...card, due: card.due.getTime(), last_review: card.last_review?.getTime() });
}
export const deserializeCard = (value: string): Card => TypeConvert.card(JSON.parse(value) as CardInput);
export function intervals(card: Card, now: Date) {
  const preview = scheduler.repeat(card, now);
  return Grades.map((rating) => ({ rating, dueAt: preview[rating].card.due.getTime() }));
}
