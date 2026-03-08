"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface YAxisRangeControlsProps {
  minInput: string;
  maxInput: string;
  onMinInputChange: (value: string) => void;
  onMaxInputChange: (value: string) => void;
  onReset: () => void;
  error?: string | null;
  isCustom?: boolean;
  className?: string;
}

const INPUT_BASE =
  "h-8 w-28 rounded-md border bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function YAxisRangeControls({
  minInput,
  maxInput,
  onMinInputChange,
  onMaxInputChange,
  onReset,
  error,
  isCustom = false,
  className
}: YAxisRangeControlsProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          Y Min
          <input
            type="number"
            step="any"
            value={minInput}
            onChange={(event) => onMinInputChange(event.target.value)}
            placeholder="auto"
            className={cn(INPUT_BASE, error ? "border-destructive" : "border-input")}
            aria-label="Y-axis minimum value"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Y Max
          <input
            type="number"
            step="any"
            value={maxInput}
            onChange={(event) => onMaxInputChange(event.target.value)}
            placeholder="auto"
            className={cn(INPUT_BASE, error ? "border-destructive" : "border-input")}
            aria-label="Y-axis maximum value"
          />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={onReset} disabled={!isCustom && !error}>
          Reset axis
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
