"use client";

import { useMemo, useState } from "react";

export type YDomainValue = number | "auto";
export type YDomain = [YDomainValue, YDomainValue];

interface ParsedBound {
  value: number | null;
  invalid: boolean;
}

function parseBound(input: string): ParsedBound {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { value: null, invalid: false };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { value: null, invalid: true };
  }

  return { value: parsed, invalid: false };
}

export interface YDomainControls {
  minInput: string;
  maxInput: string;
  setMinInput: (value: string) => void;
  setMaxInput: (value: string) => void;
  domain: YDomain;
  error: string | null;
  reset: () => void;
  isCustom: boolean;
}

export function useYDomainControls(): YDomainControls {
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");

  const minParsed = parseBound(minInput);
  const maxParsed = parseBound(maxInput);

  const error = useMemo(() => {
    if (minParsed.invalid || maxParsed.invalid) {
      return "Use valid numeric values for Y min/max.";
    }

    if (minParsed.value !== null && maxParsed.value !== null && minParsed.value > maxParsed.value) {
      return "Y min must be less than or equal to Y max.";
    }

    return null;
  }, [maxParsed.invalid, maxParsed.value, minParsed.invalid, minParsed.value]);

  const domain = useMemo<YDomain>(() => {
    if (error) {
      return ["auto", "auto"];
    }

    return [minParsed.value ?? "auto", maxParsed.value ?? "auto"];
  }, [error, maxParsed.value, minParsed.value]);

  return {
    minInput,
    maxInput,
    setMinInput,
    setMaxInput,
    domain,
    error,
    reset: () => {
      setMinInput("");
      setMaxInput("");
    },
    isCustom: minInput.trim() !== "" || maxInput.trim() !== ""
  };
}
