"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Single380AnalysisStatusCard } from "@/components/single-380-analysis-status";
import { UploadMultiDropzone } from "@/components/upload-multi-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAutoYDomain } from "@/lib/chart-domain";
import { CHART_HEIGHTS_PX } from "@/lib/chart-heights";
import { cn } from "@/lib/utils";
import { useSingle380Store } from "@/stores/single-380-store";

const ROWS = Array.from({ length: 16 }, (_, index) => String.fromCharCode(65 + index));
const COLS = Array.from({ length: 24 }, (_, index) => index + 1);
const COMPARISON_COLORS = ["#0f766e", "#d97706", "#2563eb", "#b45309", "#be123c", "#4338ca", "#15803d", "#0ea5e9"];
const SELECTION_STORAGE_KEY = "single-380-selection-v1";

interface PersistedSelectionState {
  selectionMode: boolean;
  selectedWellIds: string[];
}

function isValidWellId(wellId: string): boolean {
  return /^[A-P](?:[1-9]|1[0-9]|2[0-4])$/.test(wellId);
}

function formatYAxisTick(value: number | string): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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
  const hasRestoredSelectionState = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedSelectionState;
        if (parsed && typeof parsed === "object") {
          const persistedSelectionMode = Boolean(parsed.selectionMode);
          const persistedWellIds = Array.isArray(parsed.selectedWellIds)
            ? parsed.selectedWellIds.filter((wellId): wellId is string => typeof wellId === "string" && isValidWellId(wellId))
            : [];

          setSelectionMode(persistedSelectionMode);
          setSelectedWellIds([...new Set(persistedWellIds)]);
        }
      } catch {
        // Ignore corrupted local storage payloads.
      }
    }

    hasRestoredSelectionState.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!hasRestoredSelectionState.current) {
      return;
    }

    const payload: PersistedSelectionState = {
      selectionMode,
      selectedWellIds
    };

    window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(payload));
  }, [selectedWellIds, selectionMode]);

  const busy = status === "reading" || status === "parsing" || status === "normalizing";
  const selectedWellSet = useMemo(() => new Set(selectedWellIds), [selectedWellIds]);
  const comparisonWellIds = useMemo(
    () => selectedWellIds.filter((wellId) => (groupedByWell[wellId]?.length ?? 0) > 0),
    [groupedByWell, selectedWellIds]
  );

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

  const comparison380Data = useMemo(() => {
    const byTimepoint = new Map<number, Record<string, number | null>>();

    for (const wellId of comparisonWellIds) {
      const aggregatesByTimepoint = new Map<number, { sum: number; count: number }>();
      const wellRows = groupedByWell[wellId] ?? [];

      for (const row of wellRows) {
        if (row.f380 === null || Number.isNaN(row.f380)) {
          continue;
        }

        const bucket = aggregatesByTimepoint.get(row.timepointIndex) ?? { sum: 0, count: 0 };
        bucket.sum += row.f380;
        bucket.count += 1;
        aggregatesByTimepoint.set(row.timepointIndex, bucket);
      }

      for (const [timepointIndex, aggregate] of aggregatesByTimepoint) {
        if (!byTimepoint.has(timepointIndex)) {
          byTimepoint.set(timepointIndex, { timepointIndex });
        }
        byTimepoint.get(timepointIndex)![wellId] = aggregate.count > 0 ? aggregate.sum / aggregate.count : null;
      }
    }

    return [...byTimepoint.values()].sort((a, b) => Number(a.timepointIndex) - Number(b.timepointIndex));
  }, [comparisonWellIds, groupedByWell]);
  const comparison380Domain = useMemo(() => getAutoYDomain(comparison380Data, comparisonWellIds), [comparison380Data, comparisonWellIds]);

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

      {/*
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
      */}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Plate Map</h2>
        <p className="text-sm text-muted-foreground">
          {selectionMode
            ? "Selection mode is enabled. Click cells to select wells for export and chart comparison."
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

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Selected Wells Comparison</h2>
        <p className="text-sm text-muted-foreground">
          One line per selected well using averaged f380 values per timepoint across loaded files.
        </p>
        {comparisonWellIds.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No selected wells with data yet. Enable selection mode, select wells, and the comparison chart will appear here.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">f380 Comparison</CardTitle>
              <CardDescription>One line per selected well.</CardDescription>
            </CardHeader>
            <CardContent style={{ height: CHART_HEIGHTS_PX.dashboardComparison }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparison380Data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timepointIndex" />
                  <YAxis domain={comparison380Domain} allowDataOverflow tickFormatter={formatYAxisTick} width={64} />
                  <Tooltip />
                  <Legend />
                  {comparisonWellIds.map((wellId, idx) => (
                    <Line
                      key={wellId}
                      type="monotone"
                      dataKey={wellId}
                      name={wellId}
                      stroke={COMPARISON_COLORS[idx % COMPARISON_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
