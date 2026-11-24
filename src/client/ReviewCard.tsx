import { useContext, useEffect, useRef, useState } from "react";
import { cardTypeLabels } from "../shared/reviews";
import type { Rating, ReviewQueue } from "../shared/reviews";
import { frenchWithArticle } from "../shared/vocabulary";
import { Button } from "./Button";
import { AudioButton } from "./AudioButton";
import { PageActive } from "./Page";
import { AnswerDiff } from "./AnswerDiff";
import { Disclosure } from "./Disclosure";
import { WordDefinition } from "./WordDefinition";

const ratings = [
  { value: 1, label: "Again", hint: "Forgot the answer" }, { value: 2, label: "Hard", hint: "Remembered with difficulty" },
  { value: 3, label: "Good", hint: "Remembered correctly" }, { value: 4, label: "Easy", hint: "Remembered effortlessly" },
] as const;
function intervalLabel(due: number) {
  const minutes = Math.max(1, Math.round((due - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  const days = Math.round(minutes / 1440);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function ReviewCard({ card, disabled, saving, onGrade }: {
  card: NonNullable<ReviewQueue["card"]>; disabled: boolean; saving: boolean; onGrade: (rating: Rating) => void;
}) {
  const active = useContext(PageActive);
  const word = card.content;
  const french = frenchWithArticle(word);
  const typed = card.kind === "cloze" || card.kind === "listening";
  const expected = card.kind === "cloze" ? word.cloze.answer : french;
  const [response, setResponse] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const face = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || disabled) return;
    if (revealed) face.current?.focus({ preventScroll: true });
    else (typed ? input.current : revealButton.current)?.focus({ preventScroll: true });
  }, [active, disabled, revealed, typed]);
  useEffect(() => {
    if (!active) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || disabled ||
        (event.target as Element)?.closest("input, textarea, button, a, select, details, [role=listbox], [contenteditable]")) return;
      if (event.code === "Space" && (!typed || revealed)) { event.preventDefault(); setRevealed((value) => !value); }
      else if (revealed) {
        const rating = ratings.find((rating) => String(rating.value) === event.key);
        if (rating) { event.preventDefault(); setSelectedRating(rating.value); onGrade(rating.value); }
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [active, disabled, revealed, typed, onGrade]);

  const answerInput = <input ref={input} className="card-input"
    aria-label={card.kind === "cloze" ? "Missing French word or expression" : "French word or expression you heard"}
    lang="fr" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
    disabled={disabled} value={response} onChange={(event) => setResponse(event.target.value)} />;
  const sentenceTranslation = <p className="card-context" lang="en">{word.cloze.translation}</p>;

  return <div className="study-deck">
    <article className="flashcard" aria-label={`${cardTypeLabels[card.kind]} flashcard`}>
      <div className="card-toolbar"><span className="card-side">{revealed ? "Answer" : cardTypeLabels[card.kind]}</span>
        <div className="card-tools">
          {(revealed || card.kind === "recognition") && <AudioButton src={`/api/learning/audio/words/${word.id}`} label="Listen" compact />}
        </div>
      </div>
      <div ref={face} className="card-face" tabIndex={-1} role="group"
        aria-label={revealed ? "Answer" : "Question"}>
        <div className="card-answer" aria-hidden={!revealed} inert={!revealed}>
          <h2 lang={card.kind === "recognition" ? "en" : "fr"}>
            {card.kind === "cloze" && word.cloze.before}
            {typed ? <AnswerDiff response={response} expected={expected} /> : card.kind === "recognition" ? word.english : french}
            {card.kind === "cloze" && word.cloze.after}
          </h2>
          <div className="card-content">
            {card.kind === "cloze" ? sentenceTranslation : !typed && word.examples[0] && <p className="card-context"><q lang={card.kind === "recognition" ? "en" : "fr"}>{card.kind === "recognition" ? word.examples[0].en : word.examples[0].fr}</q></p>}
            <WordDefinition word={word} />
          </div>
        </div>
        <PageActive.Provider value={active && !revealed}>
          <form className="card-question" aria-hidden={revealed} inert={revealed} onSubmit={(event) => { event.preventDefault(); if (!disabled) setRevealed(true); }}>
            <h2 lang={card.kind === "production" ? "en" : "fr"}>
              {card.kind === "cloze" && word.cloze.before}
              {typed ? answerInput : card.kind === "recognition" ? french : word.english}
              {card.kind === "cloze" && word.cloze.after}
            </h2>
            <div className="card-content">
              {!typed && word.examples[0] && <p className="card-context"><q lang={card.kind === "recognition" ? "fr" : "en"}>{card.kind === "recognition" ? word.examples[0].fr : word.examples[0].en}</q></p>}
              {card.kind === "cloze" && sentenceTranslation}
              {card.kind === "listening" && <AudioButton src={`/api/learning/audio/words/${word.id}`} label="Listen" />}
            </div>
          </form>
        </PageActive.Provider>
      </div>
      <div className="card-bottom"><Button ref={revealButton} variant={revealed ? "secondary" : "primary"} disabled={disabled} title={revealed ? "Show question (Space)" : typed ? "Check answer (Enter)" : "Show answer (Space)"}
        onClick={() => setRevealed((value) => !value)}>{revealed ? "Show question" : typed ? "Check answer" : "Show answer"}</Button></div>
    </article>
    {revealed && <div className="study-actions" aria-label="Rate your recall">
      <div className="rating-buttons">{ratings.map((rating) => {
        const interval = intervalLabel(card.intervals.find((interval) => interval.rating === rating.value)!.dueAt);
        return <Button key={rating.value} variant="secondary" className="rating" loading={saving && selectedRating === rating.value} title={`${rating.hint} · ${rating.value}`} disabled={disabled}
        aria-label={`${rating.label}: ${rating.hint}. Review again in ${interval}`}
        onClick={() => { setSelectedRating(rating.value); onGrade(rating.value); }}><span>{rating.label}</span><small>{interval}</small></Button>;
      })}</div>
    </div>}
    {revealed && (word.examples.length > 0 || word.notes) && <section className="study-reference" aria-label="Explore this word">
      {word.examples.length > 0 && <Disclosure className="card-details" title="Examples">
        {word.examples.map((example, index) => <blockquote key={index}><p lang="fr">{example.fr}</p><p lang="en">{example.en}</p></blockquote>)}
      </Disclosure>}
      {word.notes && <Disclosure className="card-details" title="Notes">
        <p>{word.notes}</p>
      </Disclosure>}
    </section>}
  </div>;
}
