"use client";

import { useEffect } from "react";
import { OfflineNotice } from "@/components/offline-notice";
import { Button } from "@/components/ui/button";
import { isNetworkError } from "@/lib/network-error";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isNetworkError(error)) console.error(error);
  }, [error]);

  if (isNetworkError(error)) {
    return (
      <OfflineNotice message="No internet connection. Reconnect to continue." onRetry={reset} />
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[var(--app-surface)]">
      <p className="text-sm text-zinc-700 dark:text-zinc-300">This page could not be loaded.</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
