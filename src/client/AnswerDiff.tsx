import { normalizeTextKey } from "../shared/vocabulary";

type Part = { kind: "same" | "removed" | "added"; text: string };

function answerDiff(response: string, expected: string) {
  const characters = (value: string) => Array.from(value.normalize("NFC").trim().replace(/\s+/gu, " "));
  const actual = characters(response);
  const correct = characters(expected);
  const actualKeys = actual.map(normalizeTextKey);
  const correctKeys = correct.map(normalizeTextKey);
  // Align shared characters so insertions and omissions do not shift the whole answer.
  const lengths = Array.from({ length: actual.length + 1 }, () => new Uint32Array(correct.length + 1));
  for (let i = actual.length - 1; i >= 0; i--) {
    for (let j = correct.length - 1; j >= 0; j--) {
      lengths[i][j] = actualKeys[i] === correctKeys[j]
        ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const parts: Part[] = [];
  function append(kind: Part["kind"], text: string) {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  }
  let i = 0;
  let j = 0;
  while (i < actual.length || j < correct.length) {
    if (i < actual.length && j < correct.length && actualKeys[i] === correctKeys[j]) {
      append("same", actual[i++]); j++;
    } else if (i < actual.length && (j === correct.length || lengths[i + 1][j] >= lengths[i][j + 1])) {
      append("removed", actual[i++]);
    } else {
      append("added", correct[j++]);
    }
  }
  return parts;
}

export function AnswerDiff({ response, expected }: { response: string; expected: string }) {
  return <span className="answer-diff" lang="fr">{answerDiff(response, expected).map((part, index) =>
    part.kind === "removed" ? <del key={index}><span className="sr-only" lang="en">Remove: </span>{part.text}</del>
      : part.kind === "added" ? <ins key={index}><span className="sr-only" lang="en">Insert: </span>{part.text}</ins>
        : <span className="answer-match" key={index}>{part.text}</span>,
  )}</span>;
}
