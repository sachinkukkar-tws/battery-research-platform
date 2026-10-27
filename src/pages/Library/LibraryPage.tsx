import { useMemo } from "react";
import { Button } from "@/components/common/Button";
import { Card, CardBody, CardHeader } from "@/components/common/Card";
import { Controls, Field, Select, TextInput, type Option } from "@/components/common/Controls";
import { DataGate } from "@/components/common/DataGate";
import { EmptyState } from "@/components/common/Feedback";
import { LibraryList } from "@/components/tables/LibraryList";
import { COLLECTIONS } from "@/data/datasets";
import { filterLibrary, statusCounts } from "@/domain/library";
import { useDetailDialog } from "@/state/DetailDialogContext";
import { useResearchData } from "@/state/ResearchDataContext";
import { useViewState } from "@/state/ViewStateContext";
import type { PaperStatus } from "@/types";
import styles from "./Library.module.css";

const STATUS_OPTIONS: Option<"all" | PaperStatus>[] = [
  { value: "all", label: "Any status" },
  { value: "Checked", label: "Checked" },
  { value: "Extracted", label: "Extracted" },
  { value: "Harvested", label: "Harvested" },
];

export function LibraryPage() {
  return (
    <Card>
      <CardHeader
        title="Library"
        subtitle="Every paper in the platform, and how far it has got: harvested, values extracted, or values checked by a person"
      />
      <CardBody>
        <DataGate label="Loading the Library">
          <LibraryContent />
        </DataGate>
      </CardBody>
    </Card>
  );
}

function LibraryContent() {
  const { library } = useResearchData();
  const { openPaper } = useDetailDialog();
  const { libraryFilters: f, updateLibraryFilters, resetLibraryFilters } = useViewState();

  const collectionOptions = useMemo<Option[]>(() => {
    const extra = [...new Set(library.map((p) => p.collection))].filter((c) => !(COLLECTIONS as readonly string[]).includes(c));
    return [{ value: "all", label: "All papers" }, ...[...COLLECTIONS, ...extra].map((c) => ({ value: c, label: c }))];
  }, [library]);

  const list = useMemo(() => filterLibrary(library, f), [library, f]);
  const c = useMemo(() => statusCounts(library), [library]);

  return (
    <>
      <Controls>
        <Field label="Search">
          <TextInput
            type="search"
            value={f.query}
            placeholder="Title, author or ID"
            onChange={(e) => updateLibraryFilters({ query: e.target.value })}
          />
        </Field>
        <Field label="Collection">
          <Select value={f.collection} options={collectionOptions} onChange={(collection) => updateLibraryFilters({ collection })} />
        </Field>
        <Field label="Status">
          <Select value={f.status} options={STATUS_OPTIONS} onChange={(status) => updateLibraryFilters({ status })} />
        </Field>
      </Controls>
      <p className={styles.summary} aria-live="polite">
        {list.length} of {library.length} papers shown. {c.Checked} checked, {c.Extracted} extracted, {c.Harvested} harvested.
      </p>
      {list.length ? (
        <LibraryList papers={list} onOpen={openPaper} />
      ) : library.length ? (
        <EmptyState action={<Button variant="link" onClick={resetLibraryFilters}>Clear the search</Button>}>No papers match.</EmptyState>
      ) : (
        <EmptyState>No papers yet.</EmptyState>
      )}
    </>
  );
}
