"use client";

import { useEffect, useState } from "react";

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

  const active = (quotes || []).filter((q) => q.status === "active");
  const chasing = active.reduce((s, q) => s + Number(q.amount), 0);
  const won = (quotes || []).filter((q) => q.status === "responded");

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
          <strong>{won.length}</strong> responded
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
        quotes.map((q) => (
          <div key={q.id} className={`quote ${q.status}`}>
            <div className="quote-top">
              <div>
                <div className="quote-name">{q.customer_name}</div>
                <div className="quote-meta">
                  {q.description || "Quote"} · sent{" "}
                  {new Date(q.quote_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {q.status === "active" && q.next_send && (
                    <> · next follow-up {new Date(q.next_send).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                  )}
                  {Number(q.sent_count) > 0 && <> · {q.sent_count}/3 sent</>}
                </div>
              </div>
              <div className="quote-amount">{fmt(q.amount)}</div>
            </div>

            <span className={`badge ${q.status}`}>
              {q.status === "active" ? "chasing" : q.status}
            </span>

            <div className="quote-actions">
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
            </div>
          </div>
        ))}
    </div>
  );
}
