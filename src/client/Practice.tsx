import { Fragment, useId, useState } from "react";
import { Check, Plus } from "lucide-react";
import { levelLabels, levels, readingFormats } from "../shared/learning";
import type { Level, Reading, ReadingFormat, ReadingList, ReadingSelection, ReadingSettings, ReadingSummary } from "../shared/learning";
import { frenchWithArticle } from "../shared/vocabulary";
import { Button } from "./Button";
import { ReadingSkeleton, SkeletonFade } from "./Skeleton";
import { learnerOperation, learnerRequest } from "./api";
import { useResource } from "./useResource";
import { useAction } from "./useAction";
import { RequestError } from "./RequestError";
import { storeText, useStoredSelection } from "./storage";
import { AudioPlayer } from "./AudioPlayer";
import { ReadingTabs } from "./ReadingTabs";
import type { ReadingActivity } from "./ReadingTabs";
import { Select } from "./Select";
import { Page } from "./Page";
import { Disclosure } from "./Disclosure";
import { EditableSelect } from "./EditableSelect";
import { NameEditor } from "./EditorDialog";
import { ReadingSetup } from "./ReadingSetup";
import { WordGloss } from "./WordGloss";
import type { WordGlossSelection } from "./WordGloss";

export function Practice({ learnerId }: { learnerId: string }) {
  const list = useResource<ReadingList>("/api/learning/readings");
  const readings = list.data?.readings ?? [];
  const [selectedId, setSelectedId] = useStoredSelection(`mf:practice:reading:${learnerId}`, readings.map((reading) => reading.id), readings[0]?.id ?? "");
  const [level, setLevel] = useStoredSelection(`mf:practice:level:${learnerId}`, levels, levels[0]);
  const [format, setFormat] = useStoredSelection(`mf:practice:format:${learnerId}`, readingFormats, readingFormats[0]);
  const [topic, setTopic] = useState("");
  const [editor, setEditor] = useState<ReadingSummary | null>(null);
  const [setup, setSetup] = useState<{ words: ReadingSelection["words"]; settings: ReadingSettings } | null>(null);
  const selection = useAction();
  const selected = readings.find((reading) => reading.id === selectedId);
  const controlsDisabled = list.loading || selection.busy || setup !== null;

  function openReadingSetup() {
    if (controlsDisabled || !list.data) return;
    void selection.run(async () => {
      const { words } = await learnerRequest<ReadingSelection>("/api/learning/reading-selection");
      setSetup({ words, settings: { level, format, topic: topic.trim() } });
    });
  }

  function readingSaved(saved: ReadingSummary | null) {
    if (!editor) return;
    if (!saved) {
      storeText(`mf:operation:response:${learnerId}:${editor.id}`, null);
      if (selected?.id === editor.id) setSelectedId(readings.find((reading) => reading.id !== editor.id)?.id ?? "");
    }
    setEditor(null);
  }

  return <section className="study-page">
    <div className="page-heading"><h1>Practice</h1></div>
    <div className="practice-controls">
      <form className="practice-settings" onSubmit={(event) => {
        event.preventDefault();
        openReadingSetup();
      }}>
        <input aria-label="Reading topic (optional)" value={topic} disabled={controlsDisabled} onChange={(event) => setTopic(event.target.value)} placeholder="Topic (optional)" />
        <Select<Level> label="French level" value={level} disabled={controlsDisabled} onChange={setLevel} options={levels.map((value) => ({ value, label: levelLabels[value] }))} />
        <Select<ReadingFormat> label="Reading format" value={format} disabled={controlsDisabled} onChange={setFormat} options={readingFormats.map((value) => ({ value, label: value }))} />
        <Button type="submit" icon={Plus} loading={selection.busy} disabled={controlsDisabled || !list.data}>New reading</Button>
      </form>
      <RequestError error={selection.error} retry={openReadingSetup} />
      <div className="saved-readings">
        <EditableSelect label="Your readings" value={selected?.id ?? ""} disabled={controlsDisabled} loading={list.loading}
          onChange={setSelectedId} onEdit={(id) => setEditor(readings.find((reading) => reading.id === id) ?? null)}
          options={readings.map((reading) => ({ value: reading.id, label: reading.title }))} />
      </div>
    </div>
    <RequestError error={list.error} loading={list.loading} retry={list.reload} />
    {selected ? <ReadingView key={selected.id} id={selected.id} learnerId={learnerId} /> : <SkeletonFade loading={list.loading && !list.data} skeleton={<ReadingSkeleton />}>
      {!list.error && <div className="empty-state panel"><h2>No readings yet</h2><p>Create one to start practising.</p></div>}
    </SkeletonFade>}
    {editor && <ReadingEditor reading={editor} onSaved={readingSaved} onClose={() => setEditor(null)} />}
    {setup !== null && <ReadingSetup {...setup} learnerId={learnerId}
      onGenerated={(reading) => { setSelectedId(reading.id); setSetup(null); }} onClose={() => setSetup(null)} />}
  </section>;
}

function ReadingEditor({ reading, onSaved, onClose }: {
  reading: ReadingSummary; onSaved: (reading: ReadingSummary | null) => void; onClose: () => void;
}) {
  return <NameEditor title="Edit reading" fieldLabel="Title" initialValue={reading.title} onClose={onClose}
    onSave={async (title) => {
      onSaved(await learnerRequest<ReadingSummary>(`/api/learning/readings/${reading.id}`, { method: "PATCH", body: JSON.stringify({ title }) }));
    }}
    remove={{
      message: `Remove “${reading.title}”, its quiz, writing response, and feedback?`,
      onConfirm: async () => {
        await learnerRequest(`/api/learning/readings/${reading.id}`, { method: "DELETE" });
        onSaved(null);
      },
    }} />;
}

function ReadingView({ id, learnerId }: { id: string; learnerId: string }) {
  const tabsId = useId();
  const [activity, setActivity] = useState<ReadingActivity>("Read");
  const { data: reading, loading, error, reload } = useResource<Reading>(`/api/learning/readings/${id}`);
  const [selection, setSelection] = useState<WordGlossSelection | null>(null);
  const completion = useAction();
  function showMeaning(wordId: string, source: HTMLButtonElement) {
    const word = reading?.targets.find((target) => target.id === wordId);
    if (word) setSelection({ word, source });
  }
  const loadError = <RequestError error={error} loading={loading} retry={reload} />;
  const text = reading?.content.text ?? "";
  return <SkeletonFade loading={loading && !reading} skeleton={<ReadingSkeleton />}>{reading ? <article className="reading">
    <ReadingTabs id={tabsId} activity={activity} onChange={(next) => { setActivity(next); setSelection(null); }} />
    {loadError}
    <Page active={activity === "Read"}><div role="tabpanel" id={`${tabsId}-Read-panel`} aria-labelledby={`${tabsId}-Read`} tabIndex={0}>
      <div className="reading-player"><AudioPlayer src={`/api/learning/audio/readings/${id}`} /></div>
      <header className="story-heading"><p className="story-meta" lang="fr">{[reading.studyDay, reading.level, reading.format].filter(Boolean).join(" · ")}</p><h2 lang="fr">{reading.content.title}</h2></header>
      <p className="story-text" lang="fr">{reading.occurrences.map((occurrence, index) => <Fragment key={occurrence.start}>
        {text.slice(reading.occurrences[index - 1]?.end ?? 0, occurrence.start)}
        <button type="button" className="focus-word" aria-haspopup="dialog" onClick={(event) => showMeaning(occurrence.wordId, event.currentTarget)}>{text.slice(occurrence.start, occurrence.end)}</button>
      </Fragment>)}{text.slice(reading.occurrences.at(-1)?.end ?? 0)}</p>
      <WordGloss selection={selection} audioSrc={selection ? `/api/learning/audio/readings/${id}?wordId=${selection.word.id}` : ""} onClose={() => setSelection(null)} />
      {reading.targets.length > 0 && <Disclosure className="reading-vocabulary" title="Vocabulary" contentClassName="glossary">{reading.targets.map((word) => <p key={word.id}><button type="button" className="focus-word" lang="fr" aria-haspopup="dialog" onClick={(event) => showMeaning(word.id, event.currentTarget)}>{frenchWithArticle(word)}</button><span>{word.english}</span></p>)}</Disclosure>}
      {completion.error && <p className="error" role="alert">{completion.error}</p>}
      <div className="reading-finish"><Button variant="secondary" icon={Check} loading={completion.busy} disabled={reading.completed} onClick={() => void completion.run(async () => {
        await learnerRequest<Reading>(`/api/learning/readings/${id}/activity`, { method: "POST", body: JSON.stringify({ kind: "completed" }) });
      })}>{reading.completed ? "Read" : "Mark as read"}</Button></div>
    </div></Page>
    <Page active={activity === "Quiz"}><div role="tabpanel" id={`${tabsId}-Quiz-panel`} aria-labelledby={`${tabsId}-Quiz`} tabIndex={0}>
      <Quiz reading={reading} />
    </div></Page>
    <Page active={activity === "Write"}><div role="tabpanel" id={`${tabsId}-Write-panel`} aria-labelledby={`${tabsId}-Write`} tabIndex={0}>
      <WritingPractice reading={reading} learnerId={learnerId} />
    </div></Page>
  </article> : loadError}</SkeletonFade>;
}

function Quiz({ reading }: { reading: Reading }) {
  const headingId = useId();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [retaking, setRetaking] = useState(false);
  const { busy, error, run } = useAction();
  const result = !retaking ? reading.comprehension : null;
  const complete = Object.keys(answers).length === reading.content.questions.length;
  function check() {
    if (!complete) return;
    return run(async () => {
      await learnerRequest<Reading>(`/api/learning/readings/${reading.id}/activity`, { method: "POST", body: JSON.stringify({ kind: "comprehension", answers: reading.content.questions.map((_, index) => answers[index]) }) });
      setRetaking(false);
    });
  }
  return <section className="quiz" aria-labelledby={headingId}>
    <h2 id={headingId} className="sr-only">Quiz</h2>
    {result && <p className="quiz-score">{result.correct} / {result.total} correct</p>}
    {reading.content.questions.map((question, index) => <fieldset key={index} lang="fr" disabled={busy || Boolean(result)}>
      <legend>{index + 1}. {question.prompt}</legend>
      {question.options.map((option, choice) => {
        const correct = Boolean(result) && choice === question.answer;
        const incorrect = !correct && result?.answers[index] === choice;
        return <label className={`quiz-option${correct ? " correct" : incorrect ? " incorrect" : ""}`} key={choice}>
          <input type="radio" name={`question-${reading.id}-${index}`} checked={(result?.answers[index] ?? answers[index]) === choice}
            onChange={() => setAnswers((values) => ({ ...values, [index]: choice }))} />
          <span>{option}</span>
          {correct && <span className="quiz-result" lang="en">Correct answer</span>}
          {incorrect && <span className="quiz-result" lang="en">Your answer</span>}
        </label>;
      })}
      {result && <p className="hint">{question.explanation}</p>}
    </fieldset>)}
    {error && <p className="error" role="alert">{error}</p>}{result ? <Button variant="secondary" onClick={() => { setRetaking(true); setAnswers({}); }}>Retake quiz</Button> : <Button loading={busy} disabled={!complete} onClick={() => void check()}>Check answers</Button>}
  </section>;
}

function WritingPractice({ reading, learnerId }: { reading: Reading; learnerId: string }) {
  const headingId = useId();
  const responseId = useId();
  const [response, setResponse] = useState(reading.response);
  const { busy, error, setError, run } = useAction();
  const [notice, setNotice] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const text = response.trim();
  function save(feedback: boolean) {
    if (!text) return;
    return run(async () => {
      setSavingFeedback(feedback); setNotice("");
      const result = await learnerOperation<Reading>(`/api/learning/readings/${reading.id}/output`, `mf:operation:response:${learnerId}:${reading.id}`, { response: text, feedback });
      if (result.response !== text) {
        setNotice("A different response is saved on the server. Your draft is still here; save it again to use it.");
      } else if (feedback) {
        setNotice(result.feedback ? "Feedback saved." : "Response saved. Get feedback again to finish.");
      } else setNotice("Response saved.");
    });
  }
  return <section className="writing" aria-labelledby={headingId}><h2 id={headingId} className="sr-only">Write</h2><p lang="fr">{reading.content.outputPrompt}</p>
    <label className="sr-only" htmlFor={responseId}>Your French response</label><textarea id={responseId} lang="fr" rows={5} value={response} disabled={busy} onChange={(event) => { setResponse(event.target.value); setNotice(""); setError(""); }} placeholder="Your response in French" />
    <div className="writing-actions"><Button loading={busy && savingFeedback} disabled={busy || !text} onClick={() => void save(true)}>Get feedback</Button><Button variant="secondary" loading={busy && !savingFeedback} disabled={busy || !text} onClick={() => void save(false)}>Save</Button></div>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}
    {reading.feedback && text === reading.response && <div className="feedback">
      <p>{reading.feedback.encouragement}</p>
      {reading.feedback.corrections.map((correction, index) => <p key={index}>
        <span lang="fr">{correction.original} → {correction.corrected}</span>. {correction.explanation}
      </p>)}
      <p lang="fr">{reading.feedback.improved}</p>
    </div>}
    <Disclosure className="practice-extras" title="Example answer"><p lang="fr">{reading.content.modelAnswer}</p></Disclosure>
  </section>;
}
