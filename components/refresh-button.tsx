"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { refreshAppData } from "@/app/actions/refresh";
import { Button } from "@/components/ui/button";

export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshAppData();
        router.refresh();
      } catch {
        /* keep previous data visible */
      }
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={handleRefresh}
      disabled={pending}
      title="Reload data from the database"
    >
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
