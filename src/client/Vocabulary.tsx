import { useId, useState } from "react";
import { frenchWithArticle } from "../shared/vocabulary";
import type { VocabularyItem } from "../shared/vocabulary";
import { AddWords } from "./AddWords";
import { WordEditor } from "./WordEditor";
import { AudioButton } from "./AudioButton";
import { RequestError } from "./RequestError";
import { Pagination } from "./Pagination";
import { useVocabularySearch } from "./useVocabularySearch";
import { VocabularyFilters } from "./VocabularyFilters";
import { VocabularyResults } from "./VocabularyResults";
import { WordStability } from "./WordStability";

export function Vocabulary({ learnerId }: { learnerId: string }) {
  const headingId = useId();
  const [editing, setEditing] = useState<VocabularyItem | null>(null);
  const search = useVocabularySearch(`mf:vocabulary:filter:${learnerId}`);
  const { collections, data, loading, error, reload, setPage, searching, pageCount, paginationStatus } = search;
  return <>
    <div className="page-heading"><h1>Vocabulary</h1></div>
    <RequestError error={collections.error} loading={collections.loading} retry={collections.reload} />
    <div className="vocabulary-layout">
      <AddWords learnerId={learnerId} collections={collections.data ?? []} collectionsLoading={collections.loading} />
      <section className="word-library" aria-labelledby={headingId} aria-busy={searching}>
        <h2 id={headingId} className="library-heading">Your words <span className="count">{data?.totalWords ?? "–"}</span></h2>
        <VocabularyFilters search={search} />
        <RequestError error={error} loading={loading} retry={reload} />
        <VocabularyResults search={search}><ul className="word-list">{data?.items.map((item) => <li key={item.id}>
          <button type="button" className="word-open" onClick={() => setEditing(item)} aria-label={`Edit ${frenchWithArticle(item)}`}><span className="word-french" lang="fr" title={frenchWithArticle(item)}>{frenchWithArticle(item)}</span><span className="word-english" title={item.english}>{item.english}</span></button>
          <WordStability stability={item.stability} />
          <AudioButton src={`/api/learning/audio/words/${item.id}`} label="Listen" compact />
        </li>)}</ul></VocabularyResults>
        <Pagination label="Vocabulary pages" page={data?.page ?? 0} pageCount={pageCount} status={paginationStatus} disabled={searching} onChange={setPage} />
      </section>
    </div>
    {editing && <WordEditor key={editing.id} item={editing} collections={collections.data ?? []} collectionsLoading={collections.loading} onClose={() => setEditing(null)} />}
  </>;
}
