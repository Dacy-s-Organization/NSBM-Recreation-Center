"use client";

import { useEffect, useState } from "react";

/**
 * Holds back filter values for `delayMs` after the last change so the table can
 * show a loading state before the new results replace the old ones.
 */
export function useAppliedFilters<T extends Record<string, string>>(values: T, delayMs = 250) {
  const key = JSON.stringify(values);
  const [applied, setApplied] = useState(values);

  useEffect(() => {
    const timer = setTimeout(() => setApplied(JSON.parse(key) as T), delayMs);
    return () => clearTimeout(timer);
  }, [key, delayMs]);

  return { applied, filtering: JSON.stringify(applied) !== key };
}
