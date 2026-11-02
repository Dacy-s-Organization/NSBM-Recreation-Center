"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OfflineNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <span
        className="inline-flex h-3 w-3 shrink-0 animate-pulse rounded-full bg-amber-500"
        aria-hidden
      />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry && (
        <Button type="button" variant="secondary" className="px-3 py-1.5" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Shows the reconnect reminder while the browser is offline and reloads when it returns. */
export function ConnectionWatch() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const markOffline = () => setOffline(true);
    const markOnline = () => {
      setOffline(false);
      router.refresh();
    };
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markOnline);
    queueMicrotask(() => setOffline(typeof navigator !== "undefined" && navigator.onLine === false));
    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markOnline);
    };
  }, [router]);

  if (!offline) return null;

  return (
    <OfflineNotice
      message="No internet connection. Reconnect to continue."
      onRetry={() => router.refresh()}
    />
  );
}
