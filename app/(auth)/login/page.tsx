"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginSportsTransition } from "@/components/login-sports-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const finishLogin = useCallback(() => {
    router.push("/");
    router.refresh();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setCelebrating(true);
  }

  if (celebrating) {
    return <LoginSportsTransition onFinished={finishLogin} />;
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[var(--app-bg)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-100"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(34, 197, 94, 0.22), transparent 55%), radial-gradient(ellipse at 90% 20%, rgba(16, 185, 129, 0.12), transparent 40%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="NSBM Green University"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            NSBM Green University{" "}
            <span className="text-zinc-400 dark:text-zinc-500">·</span>{" "}
            <span className="text-emerald-700 dark:text-emerald-400">Recreation Center</span>
          </p>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-6">
        <div className="mb-10 max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-white">
            NSBM{" "}
            <span className="text-emerald-600 dark:text-emerald-400">Recreation Center</span>
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
            Staff portal for students, athletic records, achievements, and inventory.
          </p>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-xl shadow-emerald-950/5 backdrop-blur dark:border-white/10 dark:bg-[var(--app-surface)]/90 dark:shadow-black/40 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
              <Image
                src="/logo.png"
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
                priority
              />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">
              Staff sign in
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Use your invited recreation center account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full rounded-full py-2.5" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
