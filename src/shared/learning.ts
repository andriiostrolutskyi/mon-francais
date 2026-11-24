import { z } from "zod";
import { requiredTextSchema, vocabularyInputSchema } from "./vocabulary";
import type { VocabularyItem } from "./vocabulary";

export const levels = ["A1", "A2", "B1", "B2", "C1"] as const;
export type Level = typeof levels[number];
export const levelLabels = {
  A1: "A1 Découverte", A2: "A2 Survie", B1: "B1 Seuil",
  B2: "B2 Avancé", C1: "C1 Autonome",
};
export const readingFormats = [
  "Annonce", "Article", "Échange de courriels", "Entretien", "Guide pratique",
  "Message personnel", "Nouvelle", "Publicité", "Récit personnel", "Texte d'opinion",
] as const;
export type ReadingFormat = typeof readingFormats[number];
export const vocabularyGenerationSchema = z.object({ operationId: z.uuid(), word: requiredTextSchema, collectionId: z.uuid() });
export const vocabularyOutputSchema = z.object({ entries: z.array(vocabularyInputSchema), note: z.string() });
export type VocabularyResult = { count: number; note: string };
export type ReadingTarget = Pick<VocabularyItem, "id" | "french" | "article" | "english" | "definition" | "gender">;
export const readingTargetLimit = 20;
// Positions use JavaScript string offsets: start is inclusive, end is exclusive.
export type ReadingOccurrence = { start: number; end: number; wordId: string };
const quizAnswerSchema = z.number().int().min(0).max(3);
export const readingContentSchema = z.object({
  title: requiredTextSchema,
  text: requiredTextSchema,
  questions: z.array(z.object({
    prompt: requiredTextSchema,
    options: z.array(requiredTextSchema).length(4),
    answer: quizAnswerSchema,
    explanation: requiredTextSchema,
  })).length(3),
  outputPrompt: requiredTextSchema, modelAnswer: requiredTextSchema,
});
export const feedbackSchema = z.object({
  encouragement: requiredTextSchema,
  corrections: z.array(z.object({ original: requiredTextSchema, corrected: requiredTextSchema, explanation: requiredTextSchema })),
  improved: requiredTextSchema,
});
export const readingGenerationSchema = z.object({
  operationId: z.uuid(), level: z.enum(levels), format: z.enum(readingFormats), topic: z.string().trim(),
  wordIds: z.array(z.uuid()).max(readingTargetLimit).refine((ids) => new Set(ids).size === ids.length, "Choose each meaning once."),
});
export type ReadingGenerationInput = Omit<z.infer<typeof readingGenerationSchema>, "operationId">;
export type ReadingSettings = Omit<ReadingGenerationInput, "wordIds">;
export const readingTitleSchema = z.object({ title: requiredTextSchema });
export const readingActivitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("completed") }),
  z.object({ kind: z.literal("comprehension"), answers: z.array(quizAnswerSchema).length(3) }),
]);
export const readingResponseSchema = z.object({ operationId: z.uuid(), response: requiredTextSchema, feedback: z.boolean() });
export type ReadingContent = z.infer<typeof readingContentSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type Reading = {
  id: string; studyDay: string; level: Level; format: ReadingFormat | null;
  content: ReadingContent; targets: ReadingTarget[]; occurrences: ReadingOccurrence[];
  completed: boolean;
  comprehension: { correct: number; total: number; answers: number[] } | null;
  response: string; feedback: Feedback | null;
};
export type ReadingSummary = { id: string; title: string };
export type ReadingSelection = {
  words: Array<ReadingTarget & { stability: number | null }>;
};
export type ReadingList = {
  readings: ReadingSummary[];
};
export type Progress = {
  id: string; name: string;
  days: Array<{ day: string; reviews: number; readings: number; quizzes: number; responses: number }>;
};

export type Learner = { id: string; name: string; timezone: string };
export type Workspace = { learner: Learner };
