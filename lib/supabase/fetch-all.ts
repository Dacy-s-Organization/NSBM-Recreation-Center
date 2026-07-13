import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

/**
 * PostgREST caps a single select at ~1000 rows. Page with .range() until exhausted.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      return { data: all, error: error.message };
    }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { data: all, error: null };
}
