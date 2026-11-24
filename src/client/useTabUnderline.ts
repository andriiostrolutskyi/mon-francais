import { useLayoutEffect, useRef, useState } from "react";

export function useTabUnderline<T extends HTMLElement>(active: string | undefined) {
  const ref = useRef<T>(null);
  const [position, setPosition] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const selected = container.querySelector<HTMLElement>("[aria-current='page'], [aria-selected='true']");
    if (!selected) { setPosition(null); return; }
    const update = () => {
      if (!selected.offsetWidth) return;
      const padding = parseFloat(getComputedStyle(selected).paddingLeft);
      setPosition({ left: selected.offsetLeft + padding, width: selected.offsetWidth - padding * 2 });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(selected);
    return () => observer.disconnect();
  }, [active]);

  return { ref, underlineStyle: position };
}
