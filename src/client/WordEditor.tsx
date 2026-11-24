import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { articles, genders, vocabularyUpdateSchema, wordTypes } from "../shared/vocabulary";
import type { Collection, VocabularyInput, VocabularyItem } from "../shared/vocabulary";
import { Button } from "./Button";
import { EditorDialog, RemoveConfirmation } from "./EditorDialog";
import { useAction } from "./useAction";
import { learnerRequest } from "./api";
import { Select } from "./Select";
import { Disclosure } from "./Disclosure";

export function WordEditor({ item, collections, collectionsLoading, onClose }: {
  item: VocabularyItem; collections: Collection[]; collectionsLoading: boolean; onClose: () => void;
}) {
  const [content, setContent] = useState<VocabularyInput>({
    wordType: item.wordType, french: item.french, article: item.article, gender: item.gender, english: item.english, definition: item.definition, examples: item.examples, cloze: item.cloze, notes: item.notes,
  });
  const { busy, error, setError, run } = useAction();
  const [collectionId, setCollectionId] = useState(item.collectionId);
  const [removing, setRemoving] = useState(false);
  const controlsDisabled = busy || collectionsLoading;
  function change<K extends keyof VocabularyInput>(field: K, value: VocabularyInput[K]) { setContent((word) => ({ ...word, [field]: value })); }
  function save() {
    if (removing || collectionsLoading) return;
    if (!collections.some((collection) => collection.id === collectionId)) { setError("Choose a list for this word."); return; }
    const input = vocabularyUpdateSchema.safeParse({ ...content, collectionId, examples: content.examples.filter((example) => example.fr.trim() || example.en.trim()) });
    if (!input.success) { setError(input.error.issues[0]?.message ?? "Complete the word and both sides of each example."); return; }
    return run(async () => {
      await learnerRequest(`/api/vocabulary/${item.id}`, { method: "PATCH", body: JSON.stringify(input.data) });
      onClose();
    });
  }
  function remove() {
    return run(async () => { await learnerRequest(`/api/vocabulary/${item.id}`, { method: "DELETE" }); onClose(); });
  }
  return <EditorDialog title="Edit word" busy={busy} onClose={onClose} onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <div className="field"><span>List</span><Select label="List" value={collectionId} disabled={controlsDisabled} loading={collectionsLoading} onChange={setCollectionId} options={collections.map((collection) => ({ value: collection.id, label: collection.name }))} /></div>
    <label className="field">French<input lang="fr" required value={content.french} onChange={(event) => change("french", event.target.value)} autoFocus /></label>
    <div className="editor-grammar">
      <div className="field"><span>Word type</span><Select<VocabularyInput["wordType"]> label="Word type" value={content.wordType} disabled={controlsDisabled} onChange={(value) => change("wordType", value)} options={wordTypes.map((value) => ({ value, label: value }))} /></div>
      <div className="field"><span>Article</span><Select<VocabularyInput["article"]> label="Article" value={content.article} disabled={controlsDisabled} onChange={(value) => change("article", value)} options={[{ value: "", label: "None" }, ...articles.map((value) => ({ value, label: value }))]} /></div>
      <div className="field"><span>Gender</span><Select<VocabularyInput["gender"]> label="Gender" value={content.gender} disabled={controlsDisabled} onChange={(value) => change("gender", value)} options={[{ value: "", label: "None" }, ...genders.map((value) => ({ value, label: value }))]} /></div>
    </div>
    <label className="field">English<input required value={content.english} onChange={(event) => change("english", event.target.value)} /></label>
    <Disclosure className="editor-details" title="Examples & notes">
        <label className="field">French definition<textarea lang="fr" rows={2} value={content.definition} onChange={(event) => change("definition", event.target.value)} /></label>
        {content.examples.map((example, index) => <div className="example-fields" key={index}>
          <label className="field">French example<input lang="fr" value={example.fr} onChange={(event) => change("examples", content.examples.map((value, position) => position === index ? { ...value, fr: event.target.value } : value))} /></label>
          <label className="field">English<input value={example.en} onChange={(event) => change("examples", content.examples.map((value, position) => position === index ? { ...value, en: event.target.value } : value))} /></label>
          <Button variant="secondary" icon={Trash2} onClick={() => change("examples", content.examples.filter((_, position) => position !== index))}>Remove example</Button>
        </div>)}
        <Button variant="ghost" icon={Plus} onClick={() => change("examples", [...content.examples, { fr: "", en: "" }])}>Add example</Button>
        <h3 className="cloze-editor-heading">Sentence cloze</h3>
        <label className="field">Before the blank<input lang="fr" value={content.cloze.before} onChange={(event) => change("cloze", { ...content.cloze, before: event.target.value })} /></label>
        <label className="field">Missing French<input lang="fr" required value={content.cloze.answer} onChange={(event) => change("cloze", { ...content.cloze, answer: event.target.value })} /></label>
        <label className="field">After the blank<input lang="fr" value={content.cloze.after} onChange={(event) => change("cloze", { ...content.cloze, after: event.target.value })} /></label>
        <p className="hint" lang="fr">{content.cloze.before}___{content.cloze.after}</p>
        <label className="field">Sentence translation<input lang="en" required value={content.cloze.translation} onChange={(event) => change("cloze", { ...content.cloze, translation: event.target.value })} /></label>
        <label className="field">Notes<textarea rows={2} value={content.notes} onChange={(event) => change("notes", event.target.value)} /></label>
    </Disclosure>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="dialog-actions"><Button variant="secondary" icon={Trash2} disabled={removing} onClick={() => setRemoving(true)}>Remove</Button><Button type="submit" disabled={removing || collectionsLoading} loading={busy && !removing}>Save</Button></div>
    {removing && <RemoveConfirmation busy={busy} onCancel={() => setRemoving(false)} onRemove={() => void remove()}>
      Remove this word and its review history?
    </RemoveConfirmation>}
  </EditorDialog>;
}
