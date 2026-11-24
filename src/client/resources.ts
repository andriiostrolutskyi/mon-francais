type Snapshot = { data: unknown; loading: boolean; stale: boolean; error: string };
type Resource = ReturnType<typeof createResource>;

function createResource() {
  let snapshot: Snapshot = { data: null, loading: false, stale: true, error: "" };
  const listeners = new Set<() => void>();
  return {
    request: null as AbortController | null,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(next: Snapshot) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
}

const resources = new Map<string, Resource>();
export const emptyResource = createResource();

export function getResource(path: string) {
  let resource = resources.get(path);
  if (!resource) {
    resource = createResource();
    resources.set(path, resource);
  }
  return resource;
}

export function setResourceData<T>(path: string, update: (previous: T | null) => T | null) {
  const resource = getResource(path);
  resource.request?.abort();
  resource.request = null;
  const data = update(resource.getSnapshot().data as T | null);
  resource.publish({ data, loading: false, stale: data === null, error: "" });
}

export function invalidateResources(prefix: string) {
  for (const [path, resource] of resources) {
    if (path !== prefix && !path.startsWith(`${prefix}?`) && !path.startsWith(`${prefix}/`)) continue;
    resource.request?.abort();
    resource.request = null;
    resource.publish({ ...resource.getSnapshot(), loading: false, stale: true, error: "" });
  }
}

export async function loadResource(resource: Resource, load: (signal: AbortSignal) => Promise<unknown>) {
  if (resource.request || !resource.getSnapshot().stale) return;
  const controller = new AbortController();
  resource.request = controller;
  resource.publish({ ...resource.getSnapshot(), loading: true, stale: false, error: "" });
  try {
    const data = await load(controller.signal);
    if (!controller.signal.aborted) resource.publish({ data, loading: false, stale: false, error: "" });
  } catch (cause) {
    if (!controller.signal.aborted) resource.publish({ ...resource.getSnapshot(), loading: false, stale: false,
      error: cause instanceof Error ? cause.message : "This part of your workspace could not be opened." });
  } finally {
    if (resource.request === controller) resource.request = null;
  }
}
