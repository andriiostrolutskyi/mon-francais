import { useContext, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PageActive } from "./Page";

type Option<T> = { value: T; label: string };

export function Select<T extends string>({ value, options, onChange, label, disabled = false, loading = false }: {
  value: T; options: readonly Option<T>[]; onChange: (value: T) => void; label: string; disabled?: boolean;
  loading?: boolean;
}) {
  const id = useId();
  const active = useContext(PageActive);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const unavailable = disabled || loading || !options.length;
  const valueLabel = options[selected]?.label ?? label;
  const index = Math.min(highlighted, options.length - 1);

  useEffect(() => { if (!active || unavailable) menu.current?.hidePopover(); }, [active, unavailable]);
  useEffect(() => {
    if (open) menu.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [open, index]);

  function close() {
    menu.current?.hidePopover(); setOpen(false);
  }
  function show(next = Math.max(0, selected)) {
    if (unavailable || !active || !trigger.current) return;
    setHighlighted(next);
    trigger.current.focus({ preventScroll: true });
    menu.current?.showPopover({ source: trigger.current }); setOpen(true);
  }
  function choose(next: number) {
    if (unavailable || !active || !options[next]) return;
    close(); onChange(options[next].value);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (unavailable || event.ctrlKey || event.metaKey) return;
    const current = open ? index : Math.max(0, selected);
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape") {
      if (open) { event.preventDefault(); event.stopPropagation(); close(); }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); if (open) choose(index); else show();
    } else if (["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(event.key)) {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : event.key === "PageDown" ? 10 : -10;
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
        : current + (open ? step : 0);
      show(Math.max(0, Math.min(options.length - 1, next)));
    } else if (event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : "") + event.key.toLocaleLowerCase();
      search.current = { text, time: now };
      const prefix = [...text].every((letter) => letter === text[0]) ? text[0] : text;
      for (let offset = 0; offset < options.length; offset++) {
        const next = (current + (prefix.length === 1 ? 1 : 0) + offset) % options.length;
        if (options[next].label.toLocaleLowerCase().startsWith(prefix)) { show(next); break; }
      }
    }
  }

  return <div className="select-control" aria-busy={loading || undefined}>
    <button ref={trigger} type="button" className="select-trigger" role="combobox" aria-label={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-activedescendant={open && index >= 0 ? `${id}-${index}` : undefined}
      title={valueLabel} disabled={unavailable} onKeyDown={keyboard} onClick={() => open ? close() : show()}>
      <span>{valueLabel}</span><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
    <div ref={menu} id={id} className="select-menu" role="listbox" aria-label={label} popover="auto" onToggle={(event) => {
      const visible = event.currentTarget.matches(":popover-open");
      setOpen(visible);
      if (!visible) search.current = { text: "", time: 0 };
    }}>
      {options.map((option, optionIndex) => <button type="button" id={`${id}-${optionIndex}`} key={option.value} role="option"
        className={`select-option${optionIndex === index ? " is-highlighted" : ""}`} aria-selected={option.value === value} tabIndex={-1}
        onPointerMove={() => setHighlighted(optionIndex)} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(optionIndex)}>
        <span>{option.label}</span>{option.value === value && <Check size={18} strokeWidth={1.75} aria-hidden="true" />}
      </button>)}
    </div>
  </div>;
}
