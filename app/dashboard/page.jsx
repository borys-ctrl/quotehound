"use client";

import { useEffect, useState } from "react";

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const shortDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function Dashboard() {
  const [quotes, setQuotes] = useState(null);
  const [busy, setBusy] = useState(0);
  const [verified, setVerified] = useState(true);

  async function load() {
    const res = await fetch("/api/quotes");
    setQuotes(await res.json());
  }
  useEffect(() => {
    load();
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setVerified(!!d.email_verified_send))
      .catch(() => {});
  }, []);

  async function act(id, action) {
    setBusy(id);
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
    setBusy(0);
  }

  // Only 'active' quotes count toward money being chased — pending approval
  // ones haven't been sent yet.
  const active = (quotes || []).filter((q) => q.status === "active");
  const chasing = active.reduce((s, q) => s + Number(q.amount), 0);
  const won = (quotes || []).filter((q) => q.status === "responded");
  const pending = (quotes || []).filter((q) => q.status === "pending_approval");

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="logo">Quote<span>Hound</span></div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn" href="/settings">Settings</a>
          <a className="btn primary" href="/new">+ New quote</a>
        </div>
      </div>

      {!verified && (
        <div className="quote active" style={{ marginBottom: 20 }}>
          <div className="quote-name">Connect your sending email first</div>
          <div className="quote-meta">
            QuoteHound needs your email connected before it can chase quotes.{" "}
            <a href="/settings" style={{ fontWeight: 600 }}>Go to Settings →</a>
          </div>
        </div>
      )}

      <div className="moneystrip">
        <div>
          <div className="label">Money on the table</div>
          <div className="big">{fmt(chasing)}</div>
        </div>
        <div className="sub">
          <strong>{active.length}</strong> quotes being chased<br />
          {pending.length > 0 && <><strong>{pending.length}</strong> awaiting approval<br /></>}
          <strong>{won.length}</strong> responded
        </div>
      </div>

      <div style={{ textAlign: "center", margin: "4px 0 26px" }}>
        <a
          className="btn primary"
          href="/new"
          style={{
            display: "inline-block", fontFamily: "var(--display)",
            fontWeight: 700, fontSize: 22, textTransform: "uppercase",
            letterSpacing: "0.5px", padding: "16px 40px", borderRadius: 6,
          }}
        >
          + New quote
        </a>
        <div className="quote-meta" style={{ marginTop: 8 }}>
          Drop a quote PDF and QuoteHound drafts the follow-ups.
        </div>
      </div>

      {quotes === null && <div className="empty">Loading…</div>}

      {quotes !== null && quotes.length === 0 && (
        <div className="empty">
          No quotes yet. Add the next quote you send a customer and QuoteHound
          starts chasing it automatically.
        </div>
      )}

      {quotes !== null &&
        quotes.map((q) => {
          const isPending = q.status === "pending_approval";
          return (
            <div key={q.id} className={`quote ${q.status}`}>
              <div className="quote-top">
                <div>
                  <div className="quote-name">{q.customer_name}</div>
                  <div className="quote-meta">
                    {q.description || "Quote"} · sent {shortDate(q.quote_date)}
                    {q.status === "active" && q.next_send && (
                      <> · next follow-up {shortDate(q.next_send)}</>
                    )}
                    {Number(q.sent_count) > 0 && <> · {q.sent_count}/7 sent</>}
                  </div>
                </div>
                <div className="quote-amount">{fmt(q.amount)}</div>
              </div>

              <span className={`badge ${q.status}`}>
                {isPending
                  ? "needs approval"
                  : q.status === "active"
                  ? "chasing"
                  : q.status}
              </span>

              <div className="quote-actions">
                {isPending ? (
                  <a className="btn primary" href={`/quotes/${q.id}/approve`}>
                    Review &amp; approve →
                  </a>
                ) : (
                  <>
                    {q.status !== "responded" && (
                      <button className="won" disabled={busy === q.id} onClick={() => act(q.id, "responded")}>
                        They responded
                      </button>
                    )}
                    {q.status === "active" && (
                      <button disabled={busy === q.id} onClick={() => act(q.id, "pause")}>
                        Pause
                      </button>
                    )}
                    {q.status === "paused" && (
                      <button disabled={busy === q.id} onClick={() => act(q.id, "resume")}>
                        Resume chasing
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
