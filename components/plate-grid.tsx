"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PlateGridWellSummary {
  hasData: boolean;
  latestRatio: number | null;
  timepoints: number;
}

interface PlateGridProps {
  summaries: Record<string, PlateGridWellSummary>;
  selectionMode: boolean;
  selectedWellIds: Set<string>;
  onToggleWellSelection: (wellId: string) => void;
}

const ROWS = Array.from({ length: 16 }, (_, index) => String.fromCharCode(65 + index));
const COLS = Array.from({ length: 24 }, (_, index) => index + 1);

function formatRatio(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(3);
}

export function PlateGrid({ summaries, selectionMode, selectedWellIds, onToggleWellSelection }: PlateGridProps) {
  return (
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
                const summary = summaries[wellId] ?? {
                  hasData: false,
                  latestRatio: null,
                  timepoints: 0
                };

                return (
                  <td key={wellId} className="p-1">
                    {selectionMode ? (
                      <button
                        type="button"
                        onClick={() => onToggleWellSelection(wellId)}
                        className={cn(
                          "block min-w-[66px] rounded-md border p-1.5 text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selectedWellIds.has(wellId)
                            ? "border-accent bg-accent/30 hover:bg-accent/40"
                            : summary.hasData
                              ? "border-primary/40 bg-primary/5 hover:bg-primary/15"
                              : "border-border bg-muted/35 hover:bg-muted/55"
                        )}
                        aria-pressed={selectedWellIds.has(wellId)}
                      >
                        <p className="font-semibold leading-tight">{wellId}</p>
                        <p className="leading-tight text-muted-foreground">r: {formatRatio(summary.latestRatio)}</p>
                        <p className="leading-tight text-muted-foreground">n: {summary.timepoints}</p>
                      </button>
                    ) : (
                      <Link
                        href={`/well/${wellId}`}
                        className={cn(
                          "block min-w-[66px] rounded-md border p-1.5 text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          summary.hasData
                            ? "border-primary/40 bg-primary/5 hover:bg-primary/15"
                            : "border-border bg-muted/35 hover:bg-muted/55"
                        )}
                      >
                        <p className="font-semibold leading-tight">{wellId}</p>
                        <p className="leading-tight text-muted-foreground">r: {formatRatio(summary.latestRatio)}</p>
                        <p className="leading-tight text-muted-foreground">n: {summary.timepoints}</p>
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
  );
}
