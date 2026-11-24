import { useContext, useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "./Button";
import { PageActive } from "./Page";
import { learnerAudio } from "./api";

type Playback = { controller: AbortController; audio?: HTMLAudioElement; url?: string };

export function AudioButton({ src, label = "Listen in French", compact = false }: {
  src: string; label?: string; compact?: boolean;
}) {
  const pageActive = useContext(PageActive);
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState("");
  const active = useRef<Playback | null>(null);
  function stop() {
    const playback = active.current;
    if (!playback) return;
    playback.controller.abort(); playback.audio?.pause();
    if (playback.url) URL.revokeObjectURL(playback.url);
    active.current = null;
  }
  useEffect(() => { setStatus("idle"); setError(""); return stop; }, [src, pageActive]);
  async function play() {
    if (!pageActive) return;
    if (active.current) { stop(); setStatus("idle"); return; }
    setStatus("loading"); setError("");
    const playback: Playback = { controller: new AbortController() };
    active.current = playback;
    const finish = () => { if (active.current === playback) { stop(); setStatus("idle"); } };
    try {
      const blob = await learnerAudio(src, playback.controller.signal);
      if (playback.controller.signal.aborted) return;
      playback.url = URL.createObjectURL(blob);
      playback.audio = new Audio(playback.url);
      playback.audio.onended = finish;
      playback.audio.onerror = () => { if (active.current === playback) { setError("Couldn’t play audio. Try Listen again."); finish(); } };
      await playback.audio.play();
      if (active.current === playback) setStatus("playing");
    } catch (cause) {
      if (!playback.controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Audio is unavailable. Please try again."); finish(); }
    }
  }
  const actionLabel = status === "loading" ? "Loading audio…" : status === "playing" ? "Stop audio" : label;
  return <span className="audio-control"><Button variant={compact ? "ghost" : "secondary"} iconOnly={compact} loading={status === "loading"}
    icon={status === "playing" ? Square : Volume2} onClick={() => void play()} title={actionLabel} aria-label={actionLabel}>
    {!compact && (status === "playing" ? "Stop" : label)}
  </Button>{error && <span className="field-error" role="alert">{error}</span>}</span>;
}
