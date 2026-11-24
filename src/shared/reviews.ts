import { z } from "zod";
import type { VocabularyItem } from "./vocabulary";

// Shared order for new-card groups and study-mode options.
export const cardTypes = ["recognition", "production", "cloze", "listening"] as const;
export const cardTypeSchema = z.enum(cardTypes);
export type CardType = typeof cardTypes[number];
export const cardTypeLabels = {
  recognition: "French → English", production: "English → French", cloze: "Sentence cloze", listening: "Listening recall",
};
export const gradeInputSchema = z.object({
  operationId: z.uuid(), cardId: z.uuid(), revision: z.number().int().nonnegative(),
  rating: z.literal([1, 2, 3, 4]),
});
export const undoInputSchema = z.object({ operationId: z.uuid(), eventId: z.uuid() });
export type GradeInput = z.infer<typeof gradeInputSchema>;
export type UndoInput = z.infer<typeof undoInputSchema>;
export type Rating = GradeInput["rating"];
export type ReviewInput = GradeInput | UndoInput;
export type ReviewQueue = {
  timezone: string; counts: { due: number; new: number; completed: number };
  nextDueAt: number | null; undo: { eventId: string } | null;
  card: {
    id: string; kind: CardType; revision: number; content: VocabularyItem;
    intervals: Array<{ rating: Rating; dueAt: number }>;
  } | null;
};
