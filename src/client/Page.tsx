import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export const PageActive = createContext(true);

export function Page({ active, children, lazy = false }: { active: boolean; children: ReactNode; lazy?: boolean }) {
  const parentActive = useContext(PageActive);
  const visible = parentActive && active;
  const [visited, setVisited] = useState(visible);
  useEffect(() => { if (lazy && visible) setVisited(true); }, [lazy, visible]);
  return <PageActive.Provider value={visible}><div hidden={!active}>{(!lazy || visible || visited) && children}</div></PageActive.Provider>;
}
