import { useContext, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { Button } from "./Button";
import { PageActive } from "./Page";

export function EditableSelect({ options, value, label, disabled = false, loading = false, onChange, onEdit, create }: {
  options: readonly { value: string; label: string }[]; value: string; label: string;
  disabled?: boolean; loading?: boolean;
  onChange: (value: string) => void; onEdit: (value: string) => void;
  create?: { label: string; onClick: () => void };
}) {
  const id = useId();
  const active = useContext(PageActive);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const unavailable = disabled || loading || (!options.length && !create);
  const valueLabel = options.find((option) => option.value === value)?.label ?? label;
  useEffect(() => { if (!active || unavailable) menu.current?.hidePopover(); }, [active, unavailable]);

  return <div className="select-control" aria-busy={loading || undefined}>
    <button type="button" className="select-trigger" popoverTarget={id} aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} title={valueLabel} disabled={unavailable}>
      <span>{valueLabel}</span><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
    <div ref={menu} id={id} className="select-menu" role="dialog" aria-label={label} popover="auto"
      onToggle={(event) => setOpen(event.currentTarget.matches(":popover-open"))}>
      {options.map((option) => <div key={option.value} className="select-option-row">
        <button type="button" className="select-option" aria-pressed={option.value === value} onClick={() => { menu.current?.hidePopover(); onChange(option.value); }}>
          <span>{option.label}</span>{option.value === value && <Check size={18} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <Button variant="ghost" iconOnly icon={Pencil} aria-label={`Edit ${option.label}`} onClick={() => { menu.current?.hidePopover(); onEdit(option.value); }} />
      </div>)}
      {create && <div className="select-create"><button type="button" className="select-option" onClick={() => { menu.current?.hidePopover(); create.onClick(); }}>
        <Plus size={18} strokeWidth={1.75} aria-hidden="true" /><span>{create.label}</span>
      </button></div>}
    </div>
  </div>;
}
