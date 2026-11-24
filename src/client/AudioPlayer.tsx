import { useContext, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "./Button";
import { PageActive } from "./Page";
import { Select } from "./Select";
import { learnerAudio } from "./api";

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function AudioPlayer({ src, disabled = false }: { src: string; disabled?: boolean }) {
  const active = useContext(PageActive);
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rate, setRate] = useState("0.75");
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setUrl(""); setLoading(false); setError(""); setDuration(0); setPosition(0); setPlaying(false);
    return () => {
      request.current?.abort(); request.current = null;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = "";
    };
  }, [src]);
  useEffect(() => {
    const player = audio.current;
    if (!active || disabled) {
      request.current?.abort(); request.current = null;
      player?.pause(); setLoading(false);
    }
    return () => player?.pause();
  }, [active, disabled, url]);
  useEffect(() => { if (audio.current) audio.current.playbackRate = Number(rate); }, [rate, url]);

  async function listen() {
    if (disabled || !active || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError("");
    try {
      const blob = await learnerAudio(src, controller.signal);
      if (controller.signal.aborted) return;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      setDuration(0); setPosition(0); setUrl(objectUrl.current);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Couldn’t load audio. Please try again.");
    } finally {
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }
  function seek(seconds: number) {
    if (disabled || !active || !audio.current || !duration) return;
    const next = Math.max(0, Math.min(duration, seconds));
    audio.current.currentTime = next;
    setPosition(next);
  }
  async function togglePlayback() {
    const player = audio.current;
    if (disabled || !active || !player) return;
    setError("");
    if (!player.paused) { player.pause(); return; }
    try {
      if (player.ended) player.currentTime = 0;
      await player.play();
    } catch { setError("Couldn’t start playback. Try Play again."); }
  }

  return <div className="audio-player">
    <div className="audio-player-controls" role="group" aria-label="Reading audio player">
      <div className="audio-player-transport">
        <Button variant="ghost" iconOnly icon={RotateCcw} disabled={disabled || !duration} aria-label="Back 5 seconds" onClick={() => seek((audio.current?.currentTime ?? 0) - 5)} />
        <Button iconOnly icon={playing ? Pause : Play} loading={loading} disabled={disabled} aria-label={loading ? "Loading reading audio…" : playing ? "Pause reading" : "Play reading"} onClick={() => url ? void togglePlayback() : void listen()} />
        <Button variant="ghost" iconOnly icon={RotateCw} disabled={disabled || !duration} aria-label="Forward 5 seconds" onClick={() => seek((audio.current?.currentTime ?? 0) + 5)} />
      </div>
      <div className="audio-player-timeline">
        <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration)} disabled={disabled || !duration}
          aria-label="Playback position" aria-valuetext={`${timeLabel(position)} of ${timeLabel(duration)}`}
          style={{ backgroundImage: `linear-gradient(to right, var(--accent) ${duration ? position / duration * 100 : 0}%, var(--border) ${duration ? position / duration * 100 : 0}%)` }}
          onChange={(event) => seek(Number(event.target.value))} />
        <span className="audio-player-time" aria-hidden="true">{timeLabel(position)} / {timeLabel(duration)}</span>
      </div>
      <div className="speed-picker"><Select label="Listening speed" value={rate} disabled={disabled || loading} onChange={setRate}
        options={[{ value: "0.5", label: "0.5×" }, { value: "0.75", label: "0.75×" }, { value: "1", label: "1×" }]} /></div>
    </div>
    {url && <audio ref={audio} hidden src={url}
      onLoadedMetadata={(event) => {
        const player = event.currentTarget;
        player.playbackRate = Number(rate);
        if (active && !disabled) void player.play().catch(() => { /* The Play button remains available if autoplay is blocked. */ });
      }}
      onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
      onPlay={(event) => { if (!active || disabled) event.currentTarget.pause(); else setPlaying(true); }}
      onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setUrl(""); setDuration(0); setPosition(0); setPlaying(false); setError("Couldn’t play audio. Try Play again."); }} />}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
