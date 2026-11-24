import { BookOpen, ListChecks, PenLine, RotateCw } from "lucide-react";
import type { Progress as LearnerProgress } from "../shared/learning";
import { Button } from "./Button";
import { Skeleton, SkeletonFade } from "./Skeleton";
import { useResource } from "./useResource";
import { RequestError } from "./RequestError";

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" });
const calendarDate = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const isCompleteDay = (day: LearnerProgress["days"][number]) =>
  day.reviews > 0 && day.readings > 0 && day.quizzes > 0 && day.responses > 0;

export function Progress({ learnerId }: { learnerId: string }) {
  const { data, error, loading, reload } = useResource<{ learners: LearnerProgress[] }>("/api/learning/progress");
  return <>
    <div className="page-heading"><h1>Progress</h1><Button variant="ghost" iconOnly icon={RotateCw} loading={loading} aria-label="Refresh progress" onClick={reload} /></div>
    <RequestError error={error} loading={loading} retry={reload} />
    <div className="progress-people">
      <SkeletonFade loading={loading && !data} skeleton={<ProgressPanel learnerId={learnerId} />}>
        {data && <div aria-busy={loading}>{data.learners.map((person) =>
          <ProgressPanel key={person.id} person={person} learnerId={learnerId} />)}</div>}
      </SkeletonFade>
    </div>
  </>;
}

function ProgressPanel({ person, learnerId }: { person?: LearnerProgress; learnerId: string }) {
  const completedDays = person?.days.filter(isCompleteDay).length ?? 0;
  const readings = person?.days.reduce((total, day) => total + day.readings, 0) ?? 0;
  const quizzes = person?.days.reduce((total, day) => total + day.quizzes, 0) ?? 0;
  const responses = person?.days.reduce((total, day) => total + day.responses, 0) ?? 0;
  const reviews = person?.days.reduce((total, day) => total + day.reviews, 0) ?? 0;
  const dateRange = person ? calendarDate.formatRange(new Date(`${person.days[0].day}T12:00:00Z`), new Date(`${person.days[6].day}T12:00:00Z`)) : undefined;
  return <section className="person-progress panel" aria-label={person ? `${person.name}’s progress` : "Learner progress"}>
    {!person && <span className="sr-only" role="status">Loading learner progress…</span>}
    <div className="progress-header">
      <div>
        <h2>{person?.name ?? <Skeleton className="skeleton-inline skeleton-heading" width={120} />}</h2>
        <p className="progress-detail">{dateRange ?? <Skeleton className="skeleton-inline" width={160} />}</p>
      </div>
      {person?.id === learnerId && <span className="badge">You</span>}
    </div>
    <h3 className="progress-section-heading">Weekly goal</h3>
    <div className="progress-week">
      <div className="progress-completion">
        <p><strong>{person ? `${completedDays} / 7` : <Skeleton className="skeleton-heading" />}</strong><span>Days completed</span></p>
        <span className="progress-percent">{person ? `${Math.round(completedDays / 7 * 100)}%` : <Skeleton className="skeleton-inline skeleton-heading" width={40} />}</span>
      </div>
      <progress className="progress-bar" max={7} value={completedDays} aria-label="Days completed this week" aria-hidden={!person || undefined} />
      <div className="weekly-activity" role="list" aria-label="Daily practice" aria-hidden={!person || undefined}>{(person?.days ?? Array.from({ length: 7 }, () => undefined)).map((day, index) => {
        const active = day && isCompleteDay(day);
        const label = day ? `${day.day}: ${active ? "Complete" : "Incomplete"} · flashcard ${day.reviews > 0 ? "done" : "missing"} · reading ${day.readings > 0 ? "done" : "missing"} · quiz ${day.quizzes > 0 ? "done" : "missing"} · new writing response ${day.responses > 0 ? "done" : "missing"}` : undefined;
        return <div key={day?.day ?? index} role="listitem" aria-label={label} title={label}>
          <span className={`activity-date${active ? " is-active" : ""}`} aria-hidden="true">{day ? Number(day.day.slice(-2)) : <Skeleton className="skeleton-inline" width={16} />}</span>
          <span className="activity-day" aria-hidden="true">{day ? weekday.format(new Date(`${day.day}T12:00:00Z`)) : <Skeleton className="skeleton-inline" width={32} />}</span>
        </div>;
      })}</div>
    </div>
    <h3 className="progress-section-heading">This week's activity</h3>
    <dl className="progress-summary" aria-label="Learn and Practice this week">{[
      { label: "Reviews", value: reviews, icon: RotateCw },
      { label: "Readings", value: readings, icon: BookOpen },
      { label: "Quizzes", value: quizzes, icon: ListChecks },
      { label: "Writing", value: responses, icon: PenLine },
    ].map(({ label, value, icon: Icon }) => <div key={label}>
      <dt>{label}</dt>
      <dd><Icon aria-hidden="true" /><span>{person ? value : <Skeleton className="skeleton-inline skeleton-heading" width={36} />}</span></dd>
    </div>)}</dl>
  </section>;
}
