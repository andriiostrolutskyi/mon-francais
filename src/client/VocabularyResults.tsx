import type { CSSProperties, ReactNode } from "react";
import { vocabularyPageSize } from "../shared/vocabulary";
import { SkeletonFade, WordsSkeleton } from "./Skeleton";
import type { useVocabularySearch } from "./useVocabularySearch";

export function VocabularyResults({ search, children }: {
  search: ReturnType<typeof useVocabularySearch>; children: ReactNode;
}) {
  const filtered = Boolean(search.query || search.collectionId);
  return <div className="library-content" style={{ "--vocabulary-page-size": vocabularyPageSize } as CSSProperties}>
    <SkeletonFade loading={search.loading && !search.data} skeleton={<WordsSkeleton />}>
      {search.data?.items.length ? children : !search.error && <div className="empty-state small">
        <h3>{filtered ? "No matching words" : "No words yet"}</h3>
        <p>{filtered ? "Try another filter or add words." : "Add your first words to start learning."}</p>
      </div>}
    </SkeletonFade>
  </div>;
}
