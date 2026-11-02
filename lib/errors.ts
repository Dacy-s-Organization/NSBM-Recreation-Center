const MESSAGES: Record<string, string> = {
  "23505": "That value is already in use.",
  "23514": "That value is not allowed.",
  "42501": "You can view data but cannot change it.",
  "22003": "That number is outside the allowed range.",
};

const LEAK = /duplicate key|violates|permission denied|row-level security|PGRST|syntax error|relation "|function |operator does not exist|integer out of range/i;

type DbFailure = { code?: string; message?: string } | null | undefined;

/** Map a database error to a short message. The raw text is logged on the server. */
export function dbError(error: DbFailure, fallback = "The change could not be saved."): string {
  const message = error?.message ?? "";
  if (message) console.error(message);
  if (error?.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (message.includes("at most 10")) return "A team card can have at most 10 photos.";
  if (message.includes("Reference numbers are exhausted")) return "Reference numbers are exhausted.";
  if (!message || LEAK.test(message)) return fallback;
  return message.length > 180 ? fallback : message;
}
