"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Format a YYYY-MM-DD string without timezone drift (parse as UTC, print UTC).
function fmtYmd(s) {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Day offset from the quote date (2, 5, 9, …) computed from the stored dates.
function dayOffset(quoteDate, sendOn) {
  const p = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(sendOn) - p(quoteDate)) / 86400000);
}

export default function Approve() {
  const { id } = useParams();
  const [quote, setQuote] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(0); // followup id being edited
  const [draft, setDraft] = useState({ subject: "", body: "" });
  const [savingId, setSavingId] = useState(0);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  async function load() {
    const res = await fetch(`/api/quotes/${id}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setQuote(data.quote);
    setFollowups(data.followups);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  function startEdit(f) {
    setEditing(f.id);
    setDraft({ subject: f.subject, body: f.body });
    setError("");
  }

  async function saveEdit(f) {
    setSavingId(f.id);
    setError("");
    try {
      const res = await fetch(`/api/followups/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      const updated = await res.json();
      setFollowups((list) => list.map((x) => (x.id === f.id ? { ...x, ...updated } : x)));
      setEditing(0);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSavingId(0);
    }
  }

  async function approve() {
    setApproving(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not approve");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(String(err.message || err));
      setApproving(false);
    }
  }

  if (loading) {
    return <div className="wrap"><div className="empty">Loading…</div></div>;
  }
  if (notFound) {
    return (
      <div className="wrap">
        <div className="topbar">
          <div className="logo">Quote<span>Hound</span></div>
          <a className="btn" href="/dashboard">Dashboard</a>
        </div>
        <div className="empty">Quote not found.</div>
      </div>
    );
  }

  const pending = quote.status === "pending_approval";
  const firstName = (quote.customer_name || "").split(" ")[0];

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="logo">Quote<span>Hound</span></div>
        <a className="btn" href="/dashboard">Dashboard</a>
      </div>

      <h1 className="page">{pending ? "Approve follow-ups" : "Follow-ups"}</h1>
      <p style={{ marginBottom: 20, fontSize: 14, color: "var(--ink-soft)" }}>
        {pending ? (
          <>
            Read each message QuoteHound will send {firstName || "the customer"}.
            Edit anything, then approve to start chasing. Nothing sends until you do.
          </>
        ) : (
          <>These follow-ups for {firstName || "the customer"} are already approved.</>
        )}
      </p>

      {followups.length === 0 && (
        <div className="empty">
          No follow-ups were scheduled (the quote may have already expired).
        </div>
      )}

      {followups.map((f) => {
        const isEditing = editing === f.id;
        const editable = pending && f.status === "scheduled";
        return (
          <div key={f.id} className="quote active" style={{ marginBottom: 12 }}>
            <div className="quote-top">
              <div className="quote-meta" style={{ marginTop: 0, fontWeight: 600, color: "var(--ink)" }}>
                Day {dayOffset(quote.quote_date, f.send_on)} — {fmtYmd(f.send_on)}
                {f.status !== "scheduled" && (
                  <span className="quote-meta" style={{ marginLeft: 8 }}>· {f.status}</span>
                )}
              </div>
              {editable && !isEditing && (
                <button
                  onClick={() => startEdit(f)}
                  aria-label="Edit this email"
                  style={{ padding: "4px 10px" }}
                >
                  ✏️ Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                <label>
                  Subject
                  <input
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </label>
                <label>
                  Body
                  <textarea
                    rows={5}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="primary" disabled={savingId === f.id} onClick={() => saveEdit(f)}>
                    {savingId === f.id ? "Saving…" : "Save"}
                  </button>
                  <button disabled={savingId === f.id} onClick={() => { setEditing(0); setError(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginTop: 8, fontWeight: 600 }}>{f.subject}</div>
                <div className="quote-meta" style={{ marginTop: 4, whiteSpace: "pre-wrap", color: "var(--ink)" }}>
                  {f.body}
                </div>
              </>
            )}
          </div>
        );
      })}

      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}

      {pending && (
        <button
          className="primary"
          disabled={approving}
          onClick={approve}
          style={{ marginTop: 18, fontSize: 15, padding: "14px 22px" }}
        >
          {approving ? "Starting…" : "I read and approved these messages — start chasing"}
        </button>
      )}
    </div>
  );
}
