import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { readingTargetLimit } from "../shared/learning";
import type { Reading, ReadingGenerationInput, ReadingSelection, ReadingSettings } from "../shared/learning";
import { frenchWithArticle } from "../shared/vocabulary";
import { learnerOperation } from "./api";
import { Button } from "./Button";
import { EditorDialog } from "./EditorDialog";
import { Pagination } from "./Pagination";
import { RequestError } from "./RequestError";
import { useAction } from "./useAction";
import { useVocabularySearch } from "./useVocabularySearch";
import { VocabularyFilters } from "./VocabularyFilters";
import { VocabularyResults } from "./VocabularyResults";
import { WordStability } from "./WordStability";

export function ReadingSetup({ words: initialWords, settings, learnerId, onGenerated, onClose }: {
  words: ReadingSelection["words"]; settings: ReadingSettings; learnerId: string;
  onGenerated: (reading: Reading) => void; onClose: () => void;
}) {
  const [words, setWords] = useState(initialWords);
  const { busy, error, run } = useAction();
  const results = useVocabularySearch(`mf:practice:filter:${learnerId}`);
  const selected = new Set(words.map((word) => word.id));
  const data = results.data;

  function generate() {
    return run(async () => {
      const input: ReadingGenerationInput = { ...settings, wordIds: words.map((word) => word.id) };
      const reading = await learnerOperation<Reading>("/api/learning/readings/generate", `mf:operation:reading:${learnerId}`, input);
      onGenerated(reading);
    });
  }

  return <EditorDialog title="New reading" summary={`Selected meanings ${words.length}/${readingTargetLimit}`} busy={busy} onClose={onClose}
    onSubmit={(event) => { event.preventDefault(); void generate(); }}>
    <div className="reading-setup">
      <section aria-label="Selected meanings">
        {words.length ? <ul className="reading-selected-words">{words.map((word) => <li key={word.id}>
          <Button variant="ghost" icon={X} title={`${frenchWithArticle(word)} — ${word.english}`}
            aria-label={`Remove ${frenchWithArticle(word)} — ${word.english}`}
            onClick={() => setWords(words.filter((item) => item.id !== word.id))}>
            <span><span lang="fr">{frenchWithArticle(word)}</span><span className="hint"> — {word.english}</span></span>
            <WordStability stability={word.stability} />
          </Button>
        </li>)}</ul> : <p className="hint">No meanings selected.</p>}
      </section>
      <section aria-label="Add vocabulary">
        <RequestError error={results.collections.error} loading={results.collections.loading} retry={results.collections.reload} />
        <VocabularyFilters search={results} autoFocus disabled={busy} />
        <RequestError error={results.error} loading={results.loading} retry={results.reload} />
        <VocabularyResults search={results}>
          <ul className="word-list">{data?.items.map((word) => {
            const added = selected.has(word.id);
            return <li key={word.id}>
              <div className="word-open"><span className="word-french" lang="fr" title={frenchWithArticle(word)}>{frenchWithArticle(word)}</span>
                <span className="word-english" title={word.english}>{word.english}</span></div>
              <WordStability stability={word.stability} />
              <Button variant="ghost" iconOnly icon={added ? Check : Plus}
                aria-label={`${added ? "Already selected" : "Add"} ${frenchWithArticle(word)} — ${word.english}`}
                disabled={results.searching || added || words.length >= readingTargetLimit}
                onClick={() => setWords([...words, word])} />
            </li>;
          })}</ul>
        </VocabularyResults>
        <Pagination label="Vocabulary pages" page={data?.page ?? 0}
          pageCount={results.pageCount} status={results.paginationStatus}
          disabled={results.searching || busy} onChange={results.setPage} />
      </section>
    </div>
    <RequestError error={error} />
    <div className="dialog-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button type="submit" loading={busy}>Generate reading</Button></div>
  </EditorDialog>;
}
