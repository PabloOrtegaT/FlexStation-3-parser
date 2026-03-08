export type NumericDomain = [number | "auto", number | "auto"];

type ChartDatum = Record<string, number | string | null | undefined>;

export function getAutoYDomain(data: ChartDatum[], keys: string[], paddingRatio = 0.05): NumericDomain {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of data) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value !== "number" || Number.isNaN(value)) {
        continue;
      }

      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return ["auto", "auto"];
  }

  if (min === max) {
    const padding = Math.max(Math.abs(min) * paddingRatio, 1);
    return [min - padding, max + padding];
  }

  const range = max - min;
  const padding = range * paddingRatio;
  return [min - padding, max + padding];
}
