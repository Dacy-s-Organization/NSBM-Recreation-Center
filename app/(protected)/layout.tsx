import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[var(--app-bg)]">
      <AppNav />
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
