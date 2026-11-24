import { useContext, useEffect, useId, useState } from "react";
import { Undo2 } from "lucide-react";
import { cardTypeLabels, cardTypes } from "../shared/reviews";
import type { CardType, GradeInput, Rating, ReviewQueue, UndoInput } from "../shared/reviews";
import type { Collection } from "../shared/vocabulary";
import { Button } from "./Button";
import { ReviewSkeleton, Skeleton, SkeletonFade } from "./Skeleton";
import { learnerRequest } from "./api";
import { ReviewCard } from "./ReviewCard";
import { RequestError } from "./RequestError";
import { Select } from "./Select";
import { PageActive } from "./Page";
import { useAction } from "./useAction";
import { useResource } from "./useResource";
import { useStoredSelection } from "./storage";

type Operation = { path: "grade"; body: GradeInput } | { path: "undo"; body: UndoInput };

export function Learn({ learnerId }: { learnerId: string }) {
  const headingId = useId();
  const active = useContext(PageActive);
  const [kind, setKind] = useStoredSelection<CardType | "all">(`mf:learn:mode:${learnerId}`, ["all", ...cardTypes], "all");
  const [pending, setPending] = useState<Operation | null>(null);
  const collections = useResource<Collection[]>("/api/collections");
  const [selectedCollection, setCollectionId] = useStoredSelection(`mf:learn:filter:${learnerId}`, (collections.data ?? []).map((item) => item.id), "");
  const parameters = new URLSearchParams();
  if (kind !== "all") parameters.set("kind", kind);
  if (selectedCollection) parameters.set("collectionId", selectedCollection);
  const { data: queue, loading, error, reload } = useResource<ReviewQueue>(collections.loading || collections.error ? null : `/api/reviews/queue?${parameters}`);
  const action = useAction();
  const disabled = !active || loading || action.busy || Boolean(pending) || Boolean(error);
  const filtersDisabled = collections.loading || action.busy || Boolean(pending);

  useEffect(() => {
    if (!queue || queue.card || disabled || action.error || !queue.nextDueAt) return;
    const timer = setTimeout(reload, Math.min(2147483647, Math.max(1000, queue.nextDueAt - Date.now() + 250)));
    return () => clearTimeout(timer);
  }, [queue, disabled, action.error, reload]);

  function send(operation: Operation) {
    return action.run(async () => {
      setPending(operation);
      await learnerRequest(`/api/reviews/${operation.path}`, { method: "POST", body: JSON.stringify(operation.body) });
      setPending(null);
    });
  }
  function grade(rating: Rating) {
    if (!queue?.card || disabled) return;
    void send({ path: "grade", body: { operationId: crypto.randomUUID(), cardId: queue.card.id, revision: queue.card.revision, rating } });
  }
  const card = queue?.card;
  return <section className="learn-page study-page" aria-labelledby={headingId} aria-busy={loading || action.busy}>
    <div className="page-heading"><div><h1 id={headingId}>Learn</h1><p className="heading-summary"><SkeletonFade inline loading={loading && !queue} skeleton={<Skeleton className="skeleton-summary" />}>
      {queue ? `${queue.counts.due} due · ${queue.counts.new} new · ${queue.counts.completed} reviewed today` : "\u00a0"}
    </SkeletonFade></p></div>
      <div className="heading-actions"><div className="filter-field"><Select label="Filter by list" value={selectedCollection} loading={collections.loading} disabled={filtersDisabled} onChange={setCollectionId}
        options={[{ value: "", label: "All lists" }, ...(collections.data ?? []).map((item) => ({ value: item.id, label: item.name }))]} /></div>
        <div className="filter-field"><Select<CardType | "all"> label="Study mode" value={kind} disabled={filtersDisabled} onChange={setKind}
          options={[{ value: "all", label: "All cards" }, ...cardTypes.map((value) => ({ value, label: cardTypeLabels[value] }))]} /></div>
        <Button variant="secondary" icon={Undo2} loading={action.busy && pending?.path === "undo"} title="Undo last review" disabled={!queue?.undo || disabled} onClick={() => queue?.undo && void send({ path: "undo", body: { operationId: crypto.randomUUID(), eventId: queue.undo.eventId } })}>Undo</Button>
      </div></div>
    <RequestError error={collections.error} loading={collections.loading} retry={collections.reload} />
    <RequestError error={error || action.error} loading={action.busy || loading} retry={() => pending ? void send(pending) : reload()}>
      {pending && <Button variant="ghost" disabled={action.busy} onClick={() => { setPending(null); action.setError(""); reload(); }}>Refresh cards</Button>}
    </RequestError>
    <SkeletonFade loading={loading && !queue} skeleton={<ReviewSkeleton />}>{card ? <ReviewCard key={`${card.id}:${card.revision}`} card={card} disabled={disabled} saving={action.busy} onGrade={grade} />
      : !error && <div className="empty-state panel"><h2>{queue?.nextDueAt ? "You’re all caught up" : selectedCollection || kind !== "all" ? "No cards in this selection" : "Ready to start learning?"}</h2><p>{queue?.nextDueAt ? `Next review: ${new Intl.DateTimeFormat(undefined, { timeZone: queue.timezone, dateStyle: "medium", timeStyle: "short" }).format(queue.nextDueAt)}.` : selectedCollection || kind !== "all" ? "Try another filter or add words." : "Add your first words to get started."}</p><a className="button button--primary" href="/vocabulary">Add words</a></div>}</SkeletonFade>
  </section>;
}
