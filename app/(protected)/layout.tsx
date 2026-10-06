import { AppNav } from "@/components/app-nav";
import { ConnectionWatch } from "@/components/offline-notice";

export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <AppNav />
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <ConnectionWatch />
        {children}
      </main>
    </div>
  );
}
