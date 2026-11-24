import { frenchWithArticle } from "../shared/vocabulary";
import type { VocabularyInput } from "../shared/vocabulary";

export function WordDefinition({ word }: {
  word: Pick<VocabularyInput, "french" | "article" | "gender" | "definition">;
}) {
  return <p className="word-definition" lang="fr">
    {frenchWithArticle(word)}{word.gender && ` (${word.gender})`}
    {word.definition && <> — {word.definition.charAt(0).toLocaleLowerCase("fr")}{word.definition.slice(1)}</>}
  </p>;
}
