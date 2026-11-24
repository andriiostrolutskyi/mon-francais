import { useRef, useState } from "react";

export function useAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t save this change. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }

  return { busy, error, setError, run };
}
