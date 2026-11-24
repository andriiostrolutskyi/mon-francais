import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { VocabularyResult } from "../shared/learning";
import type { Collection } from "../shared/vocabulary";
import { normalizeTextKey } from "../shared/vocabulary";
import { Button } from "./Button";
import { NameEditor } from "./EditorDialog";
import { useAction } from "./useAction";
import { learnerOperation, learnerRequest } from "./api";
import { useStoredSelection } from "./storage";
import { EditableSelect } from "./EditableSelect";
import { Disclosure } from "./Disclosure";

export function AddWords({ learnerId, collections, collectionsLoading }: {
  learnerId: string; collections: Collection[]; collectionsLoading: boolean;
}) {
  const headingId = useId();
  const [text, setText] = useState("");
  const { busy, error, setError, run } = useAction();
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState<Array<{ text: string; issue: boolean }>>([]);
  const [collectionId, setCollectionId] = useStoredSelection(`mf:vocabulary:list:${learnerId}`, collections.map((item) => item.id), collections[0]?.id ?? "");
  const [editor, setEditor] = useState<Collection | "new" | null>(null);
  const collection = collections.find((item) => item.id === collectionId);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const words = [...new Map(text.split(/\r?\n/u).map((line) => line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/u, "")).filter(Boolean)
    .map((line) => [normalizeTextKey(line), line])).values()];

  function add() {
    if (!words.length || !collection || collectionsLoading) return;
    return run(async () => {
      setNotes([]);
      let remaining = [...words];
      let count = 0;
      const messages: Array<{ text: string; issue: boolean }> = [];
      try {
        for (let index = 0; index < words.length && mounted.current; index++) {
          const word = words[index];
          setStatus(`Adding ${index + 1} of ${words.length}`);
          const result = await learnerOperation<VocabularyResult>("/api/vocabulary", `mf:operation:vocabulary:${learnerId}`, { word, collectionId: collection.id });
          if (result.count) { count += result.count; remaining = remaining.filter((value) => value !== word); }
          if (!result.count || result.note) messages.push({ text: `${word}: ${result.note || "Add a little context and try again."}`, issue: !result.count });
          if (mounted.current) { setText(remaining.join("\n")); setNotes([...messages]); }
        }
        if (mounted.current) setStatus(count ? `${count} ${count === 1 ? "entry is" : "entries are"} ready to learn.` : "Add a little context to the words below and try again.");
      } catch (cause) {
        if (mounted.current) setStatus(count ? `${count} ${count === 1 ? "entry is" : "entries are"} ready to learn.` : "");
        throw cause;
      }
    });
  }

  return <section className="add-words panel" aria-labelledby={headingId}>
    <h2 id={headingId}>Add words</h2>
    <EditableSelect label="Choose a list" value={collection?.id ?? ""} disabled={busy} loading={collectionsLoading}
      options={collections.map((item) => ({ value: item.id, label: item.name }))} onChange={setCollectionId}
      onEdit={(id) => setEditor(collections.find((item) => item.id === id) ?? null)} create={{ label: "Create new list", onClick: () => setEditor("new") }} />
    <label className="field">French words, one per line<textarea lang="fr" rows={5} disabled={busy} value={text} onChange={(event) => { setText(event.target.value); setStatus(""); setError(""); }}
      placeholder={"le café\navoir besoin de\navocat — fruit"} />
    </label>
    <div className="add-actions"><Button loading={busy} icon={Plus} disabled={!words.length || !collection || collectionsLoading} onClick={() => void add()}>Add words</Button></div>
    {status && <p className="success" role="status">{status}</p>}{error && <p className="error" role="alert">{error}</p>}
    {notes.length > 0 && <Disclosure className="addition-notes" open={notes.some((note) => note.issue)} title={`${notes.some((note) => note.issue) ? "More context needed" : "Corrections & notes"} (${notes.length})`}>
      <ul>{notes.map((note, index) => <li key={index}>{note.text}</li>)}</ul>
    </Disclosure>}
    {editor && <CollectionEditor collection={editor === "new" ? null : editor} onSaved={(saved) => { setCollectionId(saved?.id ?? ""); setEditor(null); }} onClose={() => setEditor(null)} />}
  </section>;
}

function CollectionEditor({ collection, onSaved, onClose }: {
  collection: Collection | null; onSaved: (collection: Collection | null) => void; onClose: () => void;
}) {
  const [id] = useState(() => collection?.id ?? crypto.randomUUID());
  return <NameEditor title={collection ? "Edit list" : "New list"} initialValue={collection?.name ?? ""} onClose={onClose}
    onSave={async (name) => {
      onSaved(await learnerRequest<Collection>(`/api/collections/${id}`, { method: "PUT", body: JSON.stringify({ name }) }));
    }}
    remove={collection ? {
      message: `Remove “${collection.name}”, its words, and their review history?`,
      onConfirm: async () => {
        await learnerRequest(`/api/collections/${id}`, { method: "DELETE" });
        onSaved(null);
      },
    } : undefined} />;
}
