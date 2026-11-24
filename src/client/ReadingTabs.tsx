import { useId } from "react";
import { useTabUnderline } from "./useTabUnderline";

const activities = ["Read", "Quiz", "Write"] as const;
export type ReadingActivity = typeof activities[number];

export function ReadingTabs({ id, activity = "Read", onChange }: {
  id?: string; activity?: ReadingActivity; onChange?: (activity: ReadingActivity) => void;
}) {
  const generatedId = useId();
  const tabsId = id ?? generatedId;
  const { ref, underlineStyle } = useTabUnderline<HTMLDivElement>(activity);
  return <div ref={ref} className="reading-tabs" role="tablist" aria-label="Practice activity" onKeyDown={(event) => {
    if (!onChange || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = activities.indexOf(activity);
    const next = activities[event.key === "Home" ? 0 : event.key === "End" ? activities.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : activities.length - 1)) % activities.length];
    onChange(next);
    document.getElementById(`${tabsId}-${next}`)?.focus({ preventScroll: true });
  }}>{activities.map((name) => <button key={name} id={`${tabsId}-${name}`} type="button" role="tab"
    aria-selected={activity === name} aria-controls={onChange ? `${tabsId}-${name}-panel` : undefined}
    tabIndex={onChange && activity === name ? 0 : -1} disabled={!onChange} onClick={() => onChange?.(name)}>{name}</button>)}
    {underlineStyle && <span className="tab-underline" style={underlineStyle} aria-hidden="true" />}
  </div>;
}
