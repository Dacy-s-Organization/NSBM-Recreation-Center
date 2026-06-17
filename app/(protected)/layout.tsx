import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-zinc-50">
      <AppNav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
