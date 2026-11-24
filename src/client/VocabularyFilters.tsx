import { Search } from "lucide-react";
import { Select } from "./Select";
import type { useVocabularySearch } from "./useVocabularySearch";

export function VocabularyFilters({ search, autoFocus = false, disabled = false }: {
  search: ReturnType<typeof useVocabularySearch>; autoFocus?: boolean; disabled?: boolean;
}) {
  return <div className="library-filters">
    <div className="search-field"><Search size={18} strokeWidth={1.75} aria-hidden="true" />
      <input autoFocus={autoFocus} type="search" aria-label="Search your words" placeholder="Search words"
        value={search.query} disabled={disabled} onChange={(event) => search.setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
    </div>
    <Select label="Filter by list" value={search.collectionId} loading={search.collections.loading} disabled={disabled}
      onChange={search.setCollectionId}
      options={[{ value: "", label: "All lists" }, ...(search.collections.data ?? []).map((item) => ({ value: item.id, label: item.name }))]} />
  </div>;
}
