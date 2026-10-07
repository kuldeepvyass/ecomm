import { ShieldCheck, UserRound } from "lucide-react";
import { TEST_ACCOUNTS } from "@/lib/dev/test-accounts";
import { testSignIn } from "@/server/actions/test-login";

/** Shown on local/dev builds only: one-click sign-in to the seeded accounts, no OTP. */
export function TestAccounts({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <section aria-labelledby="test-accounts" className="mt-10 border border-dashed border-gold/60 bg-gold-soft p-5">
      <h2 id="test-accounts" className="eyebrow text-gold">Local testing · no OTP</h2>
      <p className="mt-1 text-xs text-fg-muted">Visible only on development builds.</p>
      <div className="mt-4 grid gap-3">
        {TEST_ACCOUNTS.map((a) => (
          <form key={a.email} action={testSignIn}>
            <input type="hidden" name="email" value={a.email} />
            {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
            <button type="submit" data-testid={`test-login-${a.role.toLowerCase()}`}
              className="flex min-h-14 w-full items-center gap-3 border border-border bg-bg px-4 py-3 text-left transition-colors hover:border-gold">
              {a.role === "ADMIN" ? <ShieldCheck className="size-5 shrink-0 text-gold" aria-hidden /> : <UserRound className="size-5 shrink-0 text-gold" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Continue as {a.label}</span>
                <span className="block truncate text-xs text-fg-muted">{a.email} · {a.hint}</span>
              </span>
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
