import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { Workspace } from "../shared/learning";
import { studyDay } from "../learning/study-day";
import { AccountMenu } from "./AccountMenu";
import { useResource } from "./useResource";
import { Page } from "./Page";
import { Vocabulary } from "./Vocabulary";
import { Learn } from "./Learn";
import { Practice } from "./Practice";
import { Progress } from "./Progress";
import { BookA, ChartColumnIncreasing, GraduationCap, NotebookPen } from "lucide-react";
import { Button } from "./Button";
import { useTabUnderline } from "./useTabUnderline";
import { invalidateResources } from "./resources";

const pages = [
  { path: "/learn", label: "Learn", icon: GraduationCap, component: Learn },
  { path: "/vocabulary", label: "Vocabulary", icon: BookA, component: Vocabulary },
  { path: "/practice", label: "Practice", icon: NotebookPen, component: Practice },
  { path: "/progress", label: "Progress", icon: ChartColumnIncreasing, component: Progress },
];
const getPage = (path: string) => pages.find((page) => page.path === path);

function readPath() {
  if (location.pathname === "/") history.replaceState(history.state, "", `/learn${location.search}${location.hash}`);
  return location.pathname;
}

export function App() {
  const [path, setPath] = useState(readPath);
  const previousPath = useRef(path);
  const page = getPage(path);
  const { ref: navigationRef, underlineStyle } = useTabUnderline<HTMLElement>(page?.path);
  const { data: workspace, error, loading, reload } = useResource<Workspace>("/api/workspace");
  const learner = workspace?.learner;
  useEffect(() => {
    if (!learner) return;
    let day = studyDay(new Date(), learner.timezone);
    const checkDay = () => {
      const current = studyDay(new Date(), learner.timezone);
      if (current === day) return;
      day = current;
      invalidateResources("/api/reviews/queue");
      invalidateResources("/api/learning/progress");
    };
    const timer = setInterval(checkDay, 60_000);
    window.addEventListener("focus", checkDay);
    return () => { clearInterval(timer); window.removeEventListener("focus", checkDay); };
  }, [learner]);
  useEffect(() => {
    const onPopState = () => setPath(readPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    document.title = `Mon Français - ${page?.label ?? "Page not found"}`;
    if (previousPath.current !== path) document.getElementById("main-content")?.focus({ preventScroll: true });
    previousPath.current = path;
  }, [path, page]);

  function followLink(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.pathname === "/") url.pathname = "/learn";
    if (url.origin !== location.origin || url.hash || !getPage(url.pathname)) return;
    event.preventDefault();
    if (url.pathname === path) return;
    history.pushState(null, "", `${url.pathname}${url.search}`);
    setPath(url.pathname);
    window.scrollTo(0, 0);
  }

  return <div className="app" onClick={followLink}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar">
      <a href="/learn" className="brand" aria-label="Mon Français home">Mon Français</a>
      <nav ref={navigationRef} aria-label="Main navigation">{pages.map(({ path: href, label, icon: Icon }) =>
        <a key={href} href={href} aria-label={label} title={label} aria-current={page?.path === href ? "page" : undefined}><Icon size={18} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span></a>)}
        {underlineStyle && <span className="tab-underline" style={underlineStyle} aria-hidden="true" />}
      </nav>
      <div className="header-actions">
        <AccountMenu name={learner?.name ?? "Account"} loading={loading || !learner} />
      </div>
    </header>
    <main id="main-content" className="main" tabIndex={-1}>
      {!page ? <div className="empty-state"><h1>Page not found</h1><a className="button button--primary" href="/learn">Open Learn</a></div>
        : error ? <div className="empty-state"><h1>Couldn’t open your workspace</h1><p className="error" role="alert">{error}</p><Button loading={loading} onClick={reload}>Try again</Button></div>
        : !learner ? null
        : pages.map(({ path: href, component: Component }) => <Page key={`${learner.id}:${href}`} lazy active={page.path === href}>
          <Component learnerId={learner.id} />
        </Page>)}
    </main>
  </div>;
}
