import { z } from "zod";

export const vocabularyPageSize = 6;
export const wordTypes = ["nom", "verbe", "adjectif", "adverbe", "pronom", "déterminant", "préposition", "conjonction", "interjection", "expression"] as const;
export const genders = ["masculin", "féminin", "masculin et féminin"] as const;
export const articles = ["le", "la", "l'", "les"] as const;

export const requiredTextSchema = z.string().trim().min(1, "This field is required.");
export const collectionInputSchema = z.object({ name: requiredTextSchema });
export type Collection = { id: string; name: string };

const vocabularyTextSchema = z.string().transform((text) => text.replaceAll("’", "'"));
const requiredVocabularyTextSchema = requiredTextSchema.pipe(vocabularyTextSchema);
export const vocabularyInputSchema = z.object({
  wordType: z.enum(wordTypes),
  french: requiredVocabularyTextSchema,
  article: z.enum(["", ...articles, "l’"])
    .transform((article) => article === "l’" ? "l'" : article),
  gender: z.enum(["", ...genders]),
  english: requiredVocabularyTextSchema,
  definition: z.string().trim().pipe(vocabularyTextSchema),
  examples: z.array(z.object({ fr: requiredVocabularyTextSchema, en: requiredVocabularyTextSchema })),
  cloze: z.object({ before: vocabularyTextSchema, answer: requiredVocabularyTextSchema, after: vocabularyTextSchema, translation: requiredVocabularyTextSchema }),
  notes: z.string().trim().pipe(vocabularyTextSchema),
});
export type VocabularyInput = z.output<typeof vocabularyInputSchema>;
export const vocabularyUpdateSchema = vocabularyInputSchema.extend({ collectionId: z.uuid() });
export type VocabularyItem = VocabularyInput & { id: string; collectionId: string };
export type VocabularyList = {
  items: Array<VocabularyItem & { stability: number | null }>; totalWords: number; filteredCount: number; page: number;
};

export function frenchWithArticle(word: Pick<VocabularyInput, "french" | "article">) {
  return word.article ? `${word.article}${word.article === "l'" ? "" : " "}${word.french}` : word.french;
}

export function normalizeTextKey(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").replace(/[’‘]/gu, "'").toLocaleLowerCase("fr");
}

export function vocabularyEntryKey(word: Pick<VocabularyInput, "french" | "english">) {
  return JSON.stringify([normalizeTextKey(word.french), normalizeTextKey(word.english)]);
}

export function vocabularySearchText(word: VocabularyInput) {
  return normalizeTextKey(`${frenchWithArticle(word)} ${word.english} ${word.definition}`);
}
