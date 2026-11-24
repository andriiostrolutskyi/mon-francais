import { useContext, useLayoutEffect, useRef } from "react";
import type { ReadingTarget } from "../shared/learning";
import { frenchWithArticle } from "../shared/vocabulary";
import { AudioButton } from "./AudioButton";
import { CloseButton } from "./Button";
import { PageActive } from "./Page";
import { WordDefinition } from "./WordDefinition";

export type WordGlossSelection = { word: ReadingTarget; source: HTMLButtonElement };

export function WordGloss({ selection, audioSrc, onClose }: {
  selection: WordGlossSelection | null; audioSrc: string; onClose: () => void;
}) {
  const active = useContext(PageActive);
  const gloss = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const popup = gloss.current;
    popup?.hidePopover();
    if (active && selection) popup?.showPopover({ source: selection.source });
  }, [active, selection]);
  if (!selection) return null;
  const { word } = selection;
  return <aside ref={gloss} popover="auto" role="dialog" className="word-gloss" aria-label="Saved word meaning" onToggle={(event) => {
    if (!event.currentTarget.matches(":popover-open")) onClose();
  }}>
    <div className="card-toolbar"><span className="card-side">Saved meaning</span><div className="card-tools">
      <AudioButton key={word.id} src={audioSrc} label="Listen" compact />
      <CloseButton aria-label="Close word meaning" autoFocus onClick={() => gloss.current?.hidePopover()} />
    </div></div>
    <div className="word-gloss-body">
      <h2 lang="fr">{frenchWithArticle(word)}</h2>
      <p className="card-context" lang="en">{word.english}</p>
      {(word.definition || word.gender) && <WordDefinition word={word} />}
    </div>
  </aside>;
}
