import { useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { learnerRequest } from "./api";
import { PageActive } from "./Page";
import { emptyResource, getResource, invalidateResources, loadResource } from "./resources";

export function useResource<T>(path: string | null) {
  const active = useContext(PageActive);
  const resource = path === null ? emptyResource : getResource(path);
  const state = useSyncExternalStore(resource.subscribe, resource.getSnapshot);
  useEffect(() => {
    if (active && path !== null && state.stale) {
      void loadResource(resource, (signal) => learnerRequest<T>(path, { signal }));
    }
  }, [active, path, resource, state.stale]);
  const reload = useCallback(() => {
    if (path !== null) invalidateResources(path);
  }, [path]);
  return { data: state.data as T | null, loading: state.loading || state.stale, error: state.error, reload };
}
