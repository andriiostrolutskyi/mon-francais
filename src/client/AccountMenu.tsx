import { useEffect, useId, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";

export function AccountMenu({ name, loading }: { name: string; loading: boolean }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (loading) menu.current?.hidePopover(); }, [loading]);

  return <div className="select-control" aria-busy={loading || undefined}>
    <Button variant="secondary" popoverTarget={id} aria-label={`${name}, account options`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={id} disabled={loading}>
      {name}
    </Button>
    <div ref={menu} id={id} popover="auto" role="dialog" className="select-menu account-menu" aria-label="Account options"
      onToggle={(event) => setOpen(event.currentTarget.matches(":popover-open"))}>
      <ThemeToggle />
      <a className="select-option" href="/cdn-cgi/access/logout">
        <span>Sign out</span><LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
      </a>
    </div>
  </div>;
}
