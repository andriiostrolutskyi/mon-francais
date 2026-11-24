import { useContext, useLayoutEffect, useState } from "react";
import type { AnimationEvent, ReactNode } from "react";
import { vocabularyPageSize } from "../shared/vocabulary";
import { AudioPlayer } from "./AudioPlayer";
import { PageActive } from "./Page";
import { ReadingTabs } from "./ReadingTabs";

export function SkeletonFade({ loading, skeleton, children, inline = false }: {
  loading: boolean; skeleton: ReactNode; children: ReactNode; inline?: boolean;
}) {
  const active = useContext(PageActive);
  const [retained, setRetained] = useState(loading);
  const Tag = inline ? "span" : "div";

  useLayoutEffect(() => {
    if (loading) { setRetained(true); return; }
    if (!retained) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => { if (!active || motion.matches) setRetained(false); };
    finish();
    motion.addEventListener("change", finish);
    return () => motion.removeEventListener("change", finish);
  }, [loading, retained, active]);

  return <Tag className={`skeleton-fade${inline ? " skeleton-fade--inline" : ""}`} aria-busy={loading || undefined}>
    {!loading && <Tag>{children}</Tag>}
    {(loading || retained) && <Tag className={`skeleton-placeholder${loading ? "" : " is-exiting"}`}
      aria-hidden={!loading || undefined} inert={!loading} onAnimationEnd={(event: AnimationEvent<HTMLElement>) => {
        if (event.target === event.currentTarget && !loading) setRetained(false);
      }}>{skeleton}</Tag>}
  </Tag>;
}

export function Skeleton({ className = "", width }: { className?: string; width?: number | string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} style={{ width }} />;
}

function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div role="status">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>;
}

function SkeletonLines({ lines }: { lines: number }) {
  return <div className="skeleton-lines">{Array.from({ length: lines }, (_, index) =>
    <Skeleton key={index} width={index === lines - 1 ? "62%" : index % 3 === 1 ? "94%" : "100%"} />)}</div>;
}

export function ReviewSkeleton() {
  return <SkeletonRegion label="Loading review card…"><div className="flashcard">
    <div className="card-toolbar"><Skeleton width={96} /></div>
    <div className="card-face"><div className="card-question">
      <h2><Skeleton className="skeleton-inline skeleton-heading" width="44%" /></h2>
      <div className="card-content">
        <p className="card-context"><Skeleton className="skeleton-inline" width="72%" /></p>
        <p className="word-definition"><Skeleton className="skeleton-inline" width="52%" /></p>
      </div>
    </div></div>
    <div className="card-bottom" />
  </div></SkeletonRegion>;
}

export function WordsSkeleton() {
  return <SkeletonRegion label="Loading words…"><ul className="word-list skeleton-words">
    {Array.from({ length: vocabularyPageSize }, (_, index) => <li key={index}>
      <div className="word-open"><Skeleton width={`${58 - index * 4}%`} /><Skeleton width={`${68 - index * 5}%`} /></div>
      <span className="word-stability"><Skeleton width={18} /></span>
      <span className="skeleton-word-audio" />
    </li>)}
  </ul></SkeletonRegion>;
}

export function ReadingSkeleton() {
  return <SkeletonRegion label="Loading reading…"><div className="reading skeleton-reading">
    <ReadingTabs />
    <div className="reading-player"><AudioPlayer src="" disabled /></div>
    <header className="story-heading">
      <div className="story-meta"><Skeleton width={240} /></div>
      <Skeleton className="skeleton-heading" width="58%" />
    </header>
    <div className="skeleton-reading-body"><SkeletonLines lines={5} /><SkeletonLines lines={4} /><SkeletonLines lines={3} /></div>
  </div></SkeletonRegion>;
}
