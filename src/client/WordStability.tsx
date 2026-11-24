import { CircleDashed } from "lucide-react";

function stabilityLabel(stability: number | null) {
  if (stability === null) return "Not reviewed yet";
  let days = Math.round(stability);
  if (days === 0) return "Less than 1 day";
  const parts: string[] = [];
  for (const [length, unit] of [[365, "year"], [30, "month"], [7, "week"], [1, "day"]] as const) {
    const count = Math.floor(days / length);
    if (count) parts.push(`${count} ${unit}${count === 1 ? "" : "s"}`);
    days %= length;
  }
  return parts.join(", ");
}

export function WordStability({ stability }: { stability: number | null }) {
  const progress = stability === null ? 0 : stability < 7 ? 25 : stability < 30 ? 50 : stability < 90 ? 75 : 100;
  const title = stabilityLabel(stability);
  return <span className="word-stability" title={title} role="img" aria-label={title}>
    <CircleDashed size={18} strokeWidth={1.75} aria-hidden="true">
      {progress > 0 && <circle cx={12} cy={12} r={10} stroke="var(--accent)" pathLength={100}
        strokeDasharray={`${progress} 100`} transform="rotate(-90 12 12)" />}
    </CircleDashed>
  </span>;
}
