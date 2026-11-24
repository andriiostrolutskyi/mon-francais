import { z } from "zod";
import type { Reading, ReadingList, ReadingSummary } from "../shared/learning";
import { normalizeTextKey } from "../shared/vocabulary";
import type { Collection } from "../shared/vocabulary";
import { invalidateResources, setResourceData } from "./resources";
import { readStored, storeText } from "./storage";

const operationSchema = z.object({ operationId: z.uuid(), input: z.string() });

// Save responses update shared data; derived SQL results are invalidated only by relevant writes.
function resourceChanged(path: string, method: string, data: unknown, body?: BodyInit | null) {
  if (method === "GET") return;
  if (path.startsWith("/api/collections/")) {
    const id = path.slice("/api/collections/".length);
    if (!data) invalidateResources("/api/collections");
    else setResourceData<Collection[]>("/api/collections", (current) => {
      if (!current) return null;
      const collections = current.filter((collection) => collection.id !== id);
      if (method === "PUT") collections.push(data as Collection);
      return collections.sort((a, b) => {
        const left = normalizeTextKey(a.name), right = normalizeTextKey(b.name);
        return left < right ? -1 : left > right ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    });
    if (method !== "DELETE") return;
    invalidateResources("/api/vocabulary");
    invalidateResources("/api/reviews/queue");
    invalidateResources("/api/learning/progress");
  } else if (path === "/api/vocabulary" || path.startsWith("/api/vocabulary/")) {
    invalidateResources("/api/vocabulary");
    invalidateResources("/api/reviews/queue");
    if (method === "DELETE") invalidateResources("/api/learning/progress");
  } else if (path.startsWith("/api/reviews/")) {
    invalidateResources("/api/vocabulary");
    invalidateResources("/api/reviews/queue");
    invalidateResources("/api/learning/progress");
  } else if (path === "/api/learning/readings/generate") {
    if (!data) { invalidateResources("/api/learning/readings"); return; }
    const reading = data as Reading;
    setResourceData<Reading>(`/api/learning/readings/${reading.id}`, () => reading);
    setResourceData<ReadingList>("/api/learning/readings", (current) => current ? {
      readings: [{ id: reading.id, title: reading.content.title }, ...current.readings.filter((item) => item.id !== reading.id)],
    } : null);
  } else if (path.startsWith("/api/learning/readings/")) {
    const id = path.slice("/api/learning/readings/".length).split("/")[0];
    const detail = `/api/learning/readings/${id}`;
    if (!data) {
      invalidateResources(detail);
      if (method !== "POST") invalidateResources("/api/learning/readings");
    } else if (method === "POST") {
      const reading = data as Reading;
      const activity = path.endsWith("/activity") && typeof body === "string" ? JSON.parse(body) as { kind: string } : null;
      setResourceData<Reading>(detail, (current) => {
        if (!current) return reading;
        if (path.endsWith("/output")) return { ...current, response: reading.response, feedback: reading.feedback };
        return activity?.kind === "completed" ? { ...current, completed: reading.completed }
          : { ...current, comprehension: reading.comprehension };
      });
    } else {
      const saved = method === "PATCH" ? data as ReadingSummary : null;
      setResourceData<ReadingList>("/api/learning/readings", (current) => {
        if (!current) return null;
        const readings = saved ? current.readings.map((item) => item.id === id ? saved : item) : current.readings.filter((item) => item.id !== id);
        return { readings };
      });
      setResourceData<Reading>(detail, (current) => saved && current ? { ...current, content: { ...current.content, title: saved.title } } : null);
    }
    if (method !== "PATCH") invalidateResources("/api/learning/progress");
  }
}

async function learnerFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, redirect: "manual" });
  if (response.type === "opaqueredirect") {
    window.location.reload();
    throw new Error("Sign in to your learning space again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof data?.error === "string" ? data.error : "Your request could not be completed. Please try again.");
  }
  return response;
}

export async function learnerRequest<T = void>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() ?? "GET";
  try {
    const response = await learnerFetch(path, options);
    const data: unknown = await response.json().catch(() => null);
    if (data === null) throw new Error("The server returned an unexpected response. Please try again.");
    resourceChanged(path, method, data, options?.body);
    return data as T;
  } catch (cause) {
    resourceChanged(path, method, null);
    throw cause;
  }
}

export async function learnerOperation<T>(path: string, key: string, input: Record<string, unknown>): Promise<T> {
  const serialized = JSON.stringify(input);
  const previous = readStored(key, operationSchema);
  const operation = previous?.input === serialized ? previous : { operationId: crypto.randomUUID(), input: serialized };
  storeText(key, JSON.stringify(operation));
  const result = await learnerRequest<T>(path, { method: "POST", body: JSON.stringify({ ...input, operationId: operation.operationId }) });
  storeText(key, null);
  return result;
}

export async function learnerAudio(path: string, signal: AbortSignal) {
  return (await learnerFetch(path, { signal })).blob();
}
