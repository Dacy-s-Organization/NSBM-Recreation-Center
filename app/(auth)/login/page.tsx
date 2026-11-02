"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginSportsTransition } from "@/components/login-sports-transition";
import { OfflineNotice } from "@/components/offline-notice";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { developmentLogin, mustFinishMfa, shouldOfferMfa } from "@/lib/mfa-policy";
import { isNetworkError } from "@/lib/network-error";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const offline = browserOffline || isNetworkError(error);

  useEffect(() => {
    const markOffline = () => setBrowserOffline(true);
    const markOnline = () => {
      setBrowserOffline(false);
      setError((current) => (isNetworkError(current) ? null : current));
    };
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markOnline);
    queueMicrotask(() => setBrowserOffline(navigator.onLine === false));
    const supabase = createClient();
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(async ({ data: assurance }) => {
      if (assurance?.nextLevel !== "aal2" || assurance.currentLevel === "aal2") return;
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const existing = factors?.totp.find((factor) => factor.status === "verified")?.id;
      if (!existing) return;
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: existing });
      if (!challenge) return;
      setFactorId(existing);
      setChallengeId(challenge.id);
    });
    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markOnline);
    };
  }, []);

  const finishLogin = useCallback(() => {
    router.push("/");
    router.refresh();
  }, [router]);

  async function signIn() {
    setLoading(true);
    setError(null);

    if (!navigator.onLine) {
      setBrowserOffline(true);
      setLoading(false);
      return;
    }

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

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp.find((factor) => factor.status === "verified")?.id ?? null;
    const role = (await supabase.auth.getUser()).data.user?.app_metadata?.role;
    const staffRole = typeof role === "string" ? role : null;
    let nextFactor = verified;
    let nextQr: string | null = null;
    if (!nextFactor && shouldOfferMfa(staffRole)) {
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Staff phone",
      });
      if (enrollError || !enrolled) {
        if (mustFinishMfa(staffRole)) {
          await supabase.auth.signOut();
          setError("The authenticator could not be set up.");
          setLoading(false);
          return;
        }
        setCelebrating(true);
        return;
      }
      nextFactor = enrolled.id;
      nextQr = enrolled.totp.qr_code;
    }
    if (nextFactor) {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: nextFactor,
      });
      if (challengeError || !challenge) {
        if (developmentLogin && nextQr) {
          await supabase.auth.mfa.unenroll({ factorId: nextFactor });
          setCelebrating(true);
          return;
        }
        await supabase.auth.signOut();
        setError("The authenticator challenge could not be started.");
        setLoading(false);
        return;
      }
      setFactorId(nextFactor);
      setChallengeId(challenge.id);
      setQr(nextQr);
      setLoading(false);
      return;
    }

    setCelebrating(true);
  }

  async function skipMfa() {
    if (!developmentLogin || !factorId || !qr) return;
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId });
    setCelebrating(true);
  }

  async function confirmCode() {
    if (!factorId || !challengeId) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code was not accepted.");
      setLoading(false);
      return;
    }
    setCelebrating(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (factorId) await confirmCode();
    else await signIn();
  }

  if (celebrating) {
    return <LoginSportsTransition onFinished={finishLogin} />;
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-100"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(63, 165, 53, 0.22), transparent 55%), radial-gradient(ellipse at 90% 20%, rgba(27, 79, 156, 0.14), transparent 40%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="NSBM Green University"
            width={86}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
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

        <div className="w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xl shadow-emerald-950/5 dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-black/40 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
              <Image
                src="/logo.png"
                alt=""
                width={121}
                height={56}
                className="h-14 w-auto object-contain"
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
            {factorId ? (
              <>
                {qr ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="Authenticator setup code" className="mx-auto h-40 w-40" />
                    <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                      Scan this code in an authenticator app, then enter the 6-digit code.
                    </p>
                  </>
                ) : (
                  <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                )}
                <div>
                  <Label htmlFor="code">Authenticator code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
            {offline ? (
              <OfflineNotice message="Connect to the internet to sign in." onRetry={() => void signIn()} />
            ) : error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full rounded-full py-2.5" disabled={loading}>
              {loading ? "Signing in…" : factorId ? "Confirm code" : "Sign in"}
            </Button>
            {developmentLogin && qr ? (
              <Button type="button" variant="secondary" className="w-full rounded-full py-2.5" onClick={() => void skipMfa()}>
                Continue without authenticator
              </Button>
            ) : null}
          </form>
        </div>
      </main>
    </div>
  );
}
