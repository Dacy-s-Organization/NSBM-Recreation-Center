const MAX_BATCH_NAME = 40;

/** Trimmed, with internal whitespace collapsed. Empty and over-long names are rejected. */
export function normalizeBatchName(value: string): { name: string } | { error: string } {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Enter a batch name." };
  if (name.length > MAX_BATCH_NAME) return { error: "Batch name must be 40 characters or fewer." };
  return { name };
}

export function batchKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sameBatchName(a: string, b: string): boolean {
  const left = batchKey(a);
  const right = batchKey(b);
  return left.length > 0 && left === right;
}
