function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "";
}

/** True when a request never reached the server (browser fetch failures). */
export function isNetworkError(error: unknown): boolean {
  const message = messageOf(error).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("unable to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("network request failed") ||
    message.includes("load failed") ||
    (error instanceof TypeError &&
      (message.includes("fetch") || message.includes("network") || message.includes("load")))
  );
}
