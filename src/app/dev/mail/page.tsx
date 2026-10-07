import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { DEV_MAIL_DIR } from "@/lib/email/send";

export const dynamic = "force-dynamic";

type Mail = { id: string; to: string; subject: string; tag: string; html: string; sentAt: string };

/** Local-only mailbox for emails captured when RESEND_API_KEY isn't set. */
export default async function DevMailbox({ searchParams }: PageProps<"/dev/mail">) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_TEST_MODE !== "1") notFound();
  const sp = await searchParams;
  let files: string[] = [];
  try {
    files = (await readdir(DEV_MAIL_DIR)).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 50);
  } catch {}
  const mails: Mail[] = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(DEV_MAIL_DIR, f), "utf8"))));
  const selected = mails.find((m) => m.id === sp.id) ?? mails[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", minHeight: "100dvh", fontFamily: "system-ui", background: "#fff", color: "#111" }}>
      <aside style={{ borderRight: "1px solid #ddd", overflowY: "auto" }}>
        <h1 style={{ padding: 16, fontSize: 18, margin: 0 }}>Dev mailbox ({mails.length})</h1>
        {mails.map((m) => (
          <a key={m.id} href={`?id=${m.id}`} style={{ display: "block", padding: "12px 16px", borderTop: "1px solid #eee", textDecoration: "none", color: "inherit", background: m.id === selected?.id ? "#f5efe4" : undefined }}>
            <div style={{ fontSize: 12, color: "#666" }}>{new Date(m.sentAt).toLocaleString("en-IN")} · {m.tag}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{m.subject}</div>
            <div style={{ fontSize: 12, color: "#666" }}>to {m.to}</div>
          </a>
        ))}
      </aside>
      <section>
        {selected ? (
          <iframe title={selected.subject} srcDoc={selected.html} sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" style={{ width: "100%", height: "100dvh", border: 0 }} />
        ) : (
          <p style={{ padding: 24 }}>No emails yet.</p>
        )}
      </section>
    </div>
  );
}
