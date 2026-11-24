import { useContext, useEffect, useId, useRef, useState } from "react";
import type { FormEventHandler, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button, CloseButton } from "./Button";
import { PageActive } from "./Page";
import { useAction } from "./useAction";

export function EditorDialog({ title, summary, busy, onClose, onSubmit, children }: {
  title: string; summary?: string; busy: boolean; onClose: () => void; onSubmit: FormEventHandler<HTMLFormElement>; children: ReactNode;
}) {
  const headingId = useId();
  const active = useContext(PageActive);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (active) element?.showModal();
    return () => element?.close();
  }, [active]);

  return <dialog ref={dialog} className="editor-dialog" aria-labelledby={headingId} aria-busy={busy} closedby={busy ? "none" : "any"}
    onClose={() => { if (active && !dialog.current?.open) onClose(); }}>
    <form onSubmit={onSubmit} onInvalid={(event) => {
      const details = (event.target as HTMLElement).closest("details");
      if (details) details.open = true;
    }}>
      <div className="section-header"><div><h2 id={headingId}>{title}</h2>{summary && <p className="heading-summary">{summary}</p>}</div><CloseButton aria-label="Close editor" disabled={busy} onClick={onClose} /></div>
      <fieldset disabled={busy}>{children}</fieldset>
    </form>
  </dialog>;
}

export function RemoveConfirmation({ busy, onCancel, onRemove, children }: {
  busy: boolean; onCancel: () => void; onRemove: () => void; children: ReactNode;
}) {
  return <div className="remove-confirmation">
    <p>{children}</p>
    <div className="button-group">
      <Button variant="secondary" disabled={busy} onClick={onCancel}>Keep it</Button>
      <Button variant="danger" icon={Trash2} loading={busy} onClick={onRemove}>Remove</Button>
    </div>
  </div>;
}

export function NameEditor({ title, initialValue, fieldLabel = "Name", onSave, onClose, remove }: {
  title: string; initialValue: string; fieldLabel?: string;
  onSave: (value: string) => Promise<void>; onClose: () => void;
  remove?: { message: string; onConfirm: () => Promise<void> };
}) {
  const [value, setValue] = useState(initialValue);
  const [removing, setRemoving] = useState(false);
  const { busy, error, run } = useAction();

  function save() {
    if (removing || !value.trim()) return;
    return run(() => onSave(value.trim()));
  }

  return <EditorDialog title={title} busy={busy} onClose={onClose} onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <label className="field">{fieldLabel}<input required autoFocus value={value} onChange={(event) => setValue(event.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="dialog-actions">
      {remove && <Button variant="secondary" icon={Trash2} disabled={removing} onClick={() => setRemoving(true)}>Remove</Button>}
      <Button type="submit" loading={busy && !removing} disabled={removing || !value.trim()}>Save</Button>
    </div>
    {removing && remove && <RemoveConfirmation busy={busy} onCancel={() => setRemoving(false)} onRemove={() => void run(remove.onConfirm)}>
      {remove.message}
    </RemoveConfirmation>}
  </EditorDialog>;
}
