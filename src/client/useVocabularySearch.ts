import { useEffect, useState } from "react";
import { vocabularyPageSize } from "../shared/vocabulary";
import type { Collection, VocabularyList } from "../shared/vocabulary";
import { useResource } from "./useResource";
import { useStoredSelection } from "./storage";

export function useVocabularySearch(storageKey: string) {
  const collections = useResource<Collection[]>("/api/collections");
  const [collectionId, storeCollectionId] = useStoredSelection(storageKey, (collections.data ?? []).map((item) => item.id), "");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (query === search) return;
    const timer = setTimeout(() => { setSearch(query); setPage(0); }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const parameters = new URLSearchParams({ q: search, page: String(page) });
  if (collectionId) parameters.set("collectionId", collectionId);
  const resource = useResource<VocabularyList>(collections.loading || collections.error ? null : `/api/vocabulary?${parameters}`);
  const { data, loading, error } = resource;
  useEffect(() => {
    if (data && !loading && !error) setPage(data.page);
  }, [data, loading, error]);

  return {
    ...resource, collections, collectionId, query, setQuery, setPage,
    setCollectionId(value: string) { storeCollectionId(value); setPage(0); },
    searching: loading || query !== search,
    pageCount: data ? Math.max(1, Math.ceil(data.filteredCount / vocabularyPageSize)) : 0,
    paginationStatus: data ? data.filteredCount
      ? `${data.page * vocabularyPageSize + 1}–${data.page * vocabularyPageSize + data.items.length} of ${data.filteredCount}`
      : "0 results" : undefined,
  };
}
