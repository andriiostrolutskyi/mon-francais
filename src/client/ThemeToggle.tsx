import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { readText, storeText } from "./storage";

export function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    (document.documentElement.dataset.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { if (!readText("mf:theme")) setDark(media.matches); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const Icon = dark ? Sun : Moon;

  return <button type="button" className="select-option"
    title={dark ? "Switch to light mode" : "Switch to dark mode"}
    onClick={() => {
      const next = dark ? "light" : "dark";
      storeText("mf:theme", next);
      setDark(!dark);
    }}><span>{dark ? "Light mode" : "Dark mode"}</span><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></button>;
}
