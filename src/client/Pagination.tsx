import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

export function Pagination({ label, page, pageCount, onChange, status, disabled = false }: {
  label: string; page: number; pageCount: number; onChange: (page: number) => void;
  status?: string; disabled?: boolean;
}) {
  return <nav className="pagination" aria-label={label}>
    <Button variant="ghost" iconOnly icon={ChevronLeft} aria-label="Previous page" disabled={disabled || page === 0} onClick={() => onChange(page - 1)} />
    <span role="status">{status ?? (pageCount ? `${page + 1} / ${pageCount}` : "…")}</span>
    <Button variant="ghost" iconOnly icon={ChevronRight} aria-label="Next page" disabled={disabled || page + 1 >= pageCount} onClick={() => onChange(page + 1)} />
  </nav>;
}
