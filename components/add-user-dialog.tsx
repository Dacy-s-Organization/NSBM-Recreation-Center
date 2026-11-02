"use client";

import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { data, error: invokeError } = await supabase.functions.invoke("create-staff-user", {
      body: { email: email.trim(), password },
    });

    setPending(false);

    if (invokeError) {
      let message = invokeError.message;
      if (invokeError instanceof FunctionsHttpError) {
        try {
          const body = await invokeError.context.json();
          if (body && typeof body.error === "string") message = body.error;
        } catch {
          /* keep the client message */
        }
      }
      setError(message);
      return;
    }

    if (data && typeof data.error === "string") {
      setError(data.error);
      return;
    }

    setSuccess(`${email.trim()} can sign in with the password you set.`);
    setEmail("");
    setPassword("");
    setOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-white">Staff accounts</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            New accounts can view every list. Only this super user account can change data.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Add user
        </Button>
      </div>

      {success && (
        <p className="text-sm text-emerald-800 dark:text-emerald-300">{success}</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)]">
            <h3 id="add-user-title" className="font-medium text-zinc-900 dark:text-white">
              Add user
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Set the email and password this person will use on the same sign-in page.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="staff-password">Password</Label>
                <Input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  At least 12 characters, with an uppercase letter, a lowercase letter, and a number.
                </p>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={close} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Create account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
