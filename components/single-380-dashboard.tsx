"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import { Single380AnalysisStatusCard } from "@/components/single-380-analysis-status";
import { UploadMultiDropzone } from "@/components/upload-multi-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSingle380Store } from "@/stores/single-380-store";

const ROWS = Array.from({ length: 16 }, (_, index) => String.fromCharCode(65 + index));
const COLS = Array.from({ length: 24 }, (_, index) => index + 1);

function prettyDate(iso: string | null): string {
  if (!iso) {
    return "--";
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString();
}

function formatNum(value: number | null, digits = 4): string {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

export function Single380Dashboard() {
  const { status, error, files, rows, groupedByWell, uploadedAt, analyzeFiles, clearData } = useSingle380Store();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWellIds, setSelectedWellIds] = useState<string[]>([]);

  const busy = status === "reading" || status === "parsing" || status === "normalizing";
  const selectedWellSet = useMemo(() => new Set(selectedWellIds), [selectedWellIds]);

  const gridSummaries = useMemo(() => {
    const summaries: Record<string, { hasData: boolean; latestF380: number | null; timepoints: number; filesCount: number }> = {};
    for (const [wellId, wellRows] of Object.entries(groupedByWell)) {
      const latest = [...wellRows].sort((a, b) => b.timepointIndex - a.timepointIndex)[0];
      const filesCount = new Set(wellRows.map((row) => row.sourceFileName)).size;
      summaries[wellId] = {
        hasData: wellRows.length > 0,
        latestF380: latest?.f380 ?? null,
        timepoints: wellRows.length,
        filesCount
      };
    }
    return summaries;
  }, [groupedByWell]);

  const firstMeta = files[0]?.meta ?? null;

  const handleToggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedWellIds([]);
      }
      return !prev;
    });
  };

  const handleToggleWellSelection = (wellId: string) => {
    setSelectedWellIds((prev) => {
      if (prev.includes(wellId)) {
        return prev.filter((id) => id !== wellId);
      }
      return [...prev, wellId];
    });
  };

  const handleClearSelection = () => {
    setSelectedWellIds([]);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 p-4 md:p-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <FlaskConical className="h-4 w-4 text-primary" />
          Single-Wavelength 380 (No Ratio)
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold md:text-3xl">380nm Interactive Well Grid</h1>
            <p className="text-sm text-muted-foreground">
              Upload one or more files (e.g. HIGH and MEDIUM), then click a well to inspect t380 and f380 time-series.
            </p>
          </div>
          <Button variant="secondary" onClick={clearData} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear data
          </Button>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <UploadMultiDropzone disabled={busy} onFilesSelected={analyzeFiles} />
        <Single380AnalysisStatusCard
          status={status}
          error={error}
          files={files}
          rows={rows}
          groupedByWell={groupedByWell}
          selectionMode={selectionMode}
          selectedWellIds={selectedWellIds}
          onToggleSelectionMode={handleToggleSelectionMode}
          onClearSelection={handleClearSelection}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detected Layout</CardTitle>
            <CardDescription>From the first uploaded file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Header row: <span className="font-semibold">{firstMeta?.headerRow1Based ?? "--"}</span>
            </p>
            <p>
              380 start: <span className="font-semibold">{firstMeta ? `${firstMeta.colStart380Label} (${firstMeta.colStart3801Based})` : "--"}</span>
            </p>
            <p>
              First cycle row: <span className="font-semibold">{firstMeta?.firstCycleStartRow1Based ?? "--"}</span>
            </p>
            <p>
              Cycle stride: <span className="font-semibold">{firstMeta?.cycleStride ?? "--"}</span>
            </p>
            <p>
              Uploaded at: <span className="font-semibold">{prettyDate(uploadedAt)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Loaded Files</CardTitle>
            <CardDescription>All files are normalized and merged in this tab. Click a well to open its dedicated details page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {files.length === 0 ? (
              <p className="text-muted-foreground">No files loaded.</p>
            ) : (
              files.map((file) => (
                <p key={file.sourceFileName}>
                  <span className="font-semibold">{file.sourceFileName}</span> ({file.rows.length} rows)
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Plate Map</h2>
        <p className="text-sm text-muted-foreground">
          {selectionMode
            ? "Selection mode is enabled. Click cells to select wells for export."
            : "Click a cell to inspect combined file traces for that well."}
        </p>
        <div className="overflow-x-auto rounded-xl border bg-card p-3 shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-10 p-1 text-left text-muted-foreground">Well</th>
                {COLS.map((col) => (
                  <th key={col} className="p-1 text-center font-medium text-muted-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((rowLetter) => (
                <tr key={rowLetter}>
                  <th className="p-1 text-left text-muted-foreground">{rowLetter}</th>
                  {COLS.map((plateCol) => {
                    const wellId = `${rowLetter}${plateCol}`;
                    const summary = gridSummaries[wellId] ?? {
                      hasData: false,
                      latestF380: null,
                      timepoints: 0,
                      filesCount: 0
                    };
                    const exportSelected = selectedWellSet.has(wellId);
                    return (
                      <td key={wellId} className="p-1">
                        {selectionMode ? (
                          <button
                            type="button"
                            onClick={() => handleToggleWellSelection(wellId)}
                            className={cn(
                              "block min-w-[70px] rounded-md border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              exportSelected
                                ? "border-accent bg-accent/30 hover:bg-accent/40"
                                : summary.hasData
                                  ? "border-primary/40 bg-primary/5 hover:bg-primary/15"
                                  : "border-border bg-muted/35 hover:bg-muted/55"
                            )}
                            aria-pressed={exportSelected}
                          >
                            <p className="font-semibold leading-tight">{wellId}</p>
                            <p className="leading-tight text-muted-foreground">f: {formatNum(summary.latestF380, 3)}</p>
                            <p className="leading-tight text-muted-foreground">n: {summary.timepoints}</p>
                            <p className="leading-tight text-muted-foreground">files: {summary.filesCount}</p>
                          </button>
                        ) : (
                          <Link
                            href={`/single-380/well/${wellId}`}
                            className={cn(
                              "block min-w-[70px] rounded-md border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              summary.hasData
                                ? "border-primary/40 bg-primary/5 hover:bg-primary/15"
                                : "border-border bg-muted/35 hover:bg-muted/55"
                            )}
                          >
                            <p className="font-semibold leading-tight">{wellId}</p>
                            <p className="leading-tight text-muted-foreground">f: {formatNum(summary.latestF380, 3)}</p>
                            <p className="leading-tight text-muted-foreground">n: {summary.timepoints}</p>
                            <p className="leading-tight text-muted-foreground">files: {summary.filesCount}</p>
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
