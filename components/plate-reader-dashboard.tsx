"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Beaker, FlaskConical, Trash2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnalysisStatusCard } from "@/components/analysis-status";
import { PlateGrid } from "@/components/plate-grid";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAutoYDomain } from "@/lib/chart-domain";
import { CHART_HEIGHTS_PX } from "@/lib/chart-heights";
import { usePlateDataStore } from "@/stores/plate-data-store";

const COMPARISON_COLORS = ["#0f766e", "#d97706", "#2563eb", "#b45309", "#be123c", "#4338ca", "#15803d", "#0ea5e9"];
const SELECTION_STORAGE_KEY = "plate-reader-selection-v1";

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

export function PlateReaderDashboard() {
  const { status, error, meta, groupedByWell, rows, sourceFileName, uploadedAt, analyzeFile, clearData } = usePlateDataStore();
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
    const summaries: Record<string, { hasData: boolean; latestRatio: number | null; timepoints: number }> = {};
    for (const [wellId, series] of Object.entries(groupedByWell)) {
      const latest = series[series.length - 1];
      summaries[wellId] = {
        hasData: series.length > 0,
        latestRatio: latest?.ratio ?? null,
        timepoints: series.length
      };
    }
    return summaries;
  }, [groupedByWell]);

  const comparison340Data = useMemo(() => {
    const byTimepoint = new Map<number, Record<string, number | null>>();

    for (const wellId of comparisonWellIds) {
      const wellSeries = groupedByWell[wellId] ?? [];
      for (const point of wellSeries) {
        if (!byTimepoint.has(point.timepointIndex)) {
          byTimepoint.set(point.timepointIndex, { timepointIndex: point.timepointIndex });
        }
        byTimepoint.get(point.timepointIndex)![wellId] = point.f340;
      }
    }

    return [...byTimepoint.values()].sort((a, b) => Number(a.timepointIndex) - Number(b.timepointIndex));
  }, [comparisonWellIds, groupedByWell]);

  const comparison380Data = useMemo(() => {
    const byTimepoint = new Map<number, Record<string, number | null>>();

    for (const wellId of comparisonWellIds) {
      const wellSeries = groupedByWell[wellId] ?? [];
      for (const point of wellSeries) {
        if (!byTimepoint.has(point.timepointIndex)) {
          byTimepoint.set(point.timepointIndex, { timepointIndex: point.timepointIndex });
        }
        byTimepoint.get(point.timepointIndex)![wellId] = point.f380;
      }
    }

    return [...byTimepoint.values()].sort((a, b) => Number(a.timepointIndex) - Number(b.timepointIndex));
  }, [comparisonWellIds, groupedByWell]);

  const comparison340Domain = useMemo(() => getAutoYDomain(comparison340Data, comparisonWellIds), [comparison340Data, comparisonWellIds]);
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
          340/380 Wavelengths + ratio
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold md:text-3xl">24x16 Interactive Well Grid</h1>
            <p className="text-sm text-muted-foreground">
              Upload old machine `.xlsx` files, normalize 340/380 measurements, and inspect per-well time-series.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={clearData} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear data
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <UploadDropzone disabled={busy} onFileSelected={analyzeFile} />
        <AnalysisStatusCard
          status={status}
          error={error}
          sourceFileName={sourceFileName}
          rows={rows}
          groupedByWell={groupedByWell}
          selectionMode={selectionMode}
          selectedWellIds={selectedWellIds}
          onToggleSelectionMode={handleToggleSelectionMode}
          onClearSelection={handleClearSelection}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Plate Map</h2>
        <p className="text-sm text-muted-foreground">
          {selectionMode
            ? "Selection mode is enabled. Click cells to select wells for export and chart comparison."
            : "Each cell shows the latest ratio and number of timepoints. Click any cell to open the well detail page."}
        </p>
        <PlateGrid
          summaries={gridSummaries}
          selectionMode={selectionMode}
          selectedWellIds={selectedWellSet}
          onToggleWellSelection={handleToggleWellSelection}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Selected Wells Comparison</h2>
        <p className="text-sm text-muted-foreground">
          Compare selected wells by wavelength. Use "Select wells" in Analysis Status, then click plate cells.
        </p>
        {comparisonWellIds.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No selected wells with data yet. Enable selection mode, select wells, and comparison charts will appear here.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">f340 Comparison</CardTitle>
                <CardDescription>One line per selected well.</CardDescription>
              </CardHeader>
              <CardContent style={{ height: CHART_HEIGHTS_PX.dashboardComparison }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparison340Data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timepointIndex" />
                    <YAxis domain={comparison340Domain} allowDataOverflow tickFormatter={formatYAxisTick} width={64} />
                    <Tooltip />
                    <Legend />
                    {comparisonWellIds.map((wellId, idx) => (
                      <Line
                        key={`f340-${wellId}`}
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
                        key={`f380-${wellId}`}
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
          </div>
        )}
      </section>

      {/*
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dataset Summary</CardTitle>
            <CardDescription>Live snapshot of normalized output.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Rows parsed: <span className="font-semibold">{rows.length}</span>
            </p>
            <p>
              Wells with data: <span className="font-semibold">{Object.keys(groupedByWell).length}</span>
            </p>
            <p>
              Uploaded at: <span className="font-semibold">{prettyDate(uploadedAt)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detected Layout</CardTitle>
            <CardDescription>Computed automatically from worksheet content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Header row: <span className="font-semibold">{meta?.headerRow1Based ?? "--"}</span>
            </p>
            <p>
              340 start: <span className="font-semibold">{meta ? `${meta.colStart340Label} (${meta.colStart3401Based})` : "--"}</span>
            </p>
            <p>
              380 start: <span className="font-semibold">{meta ? `${meta.colStart380Label} (${meta.colStart3801Based})` : "--"}</span>
            </p>
            <p>
              Cycle stride: <span className="font-semibold">{meta?.cycleStride ?? "--"}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Access</CardTitle>
            <CardDescription>Go directly to any well detail view.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col justify-between text-sm">
            <p className="text-muted-foreground">Each tile in the grid opens a dedicated detail route.</p>
            <Button asChild className="mt-4 w-full">
              <Link href="/well/A1">
                <Beaker className="mr-2 h-4 w-4" />
                Browse Well Details
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
      */}
    </main>
  );
}
