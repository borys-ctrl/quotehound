"use client";

import { useEffect, useRef, useState } from "react";

const emptyForm = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  amount: "",
  description: "",
  quote_date: new Date().toISOString().slice(0, 10),
  expires_on: "",
};

export default function NewQuote() {
  const [form, setForm] = useState(emptyForm);
  const [stage, setStage] = useState("pick"); // pick | entry | done
  const [fromPdf, setFromPdf] = useState(false);
  const [state, setState] = useState("idle"); // idle | saving | error
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sequence, setSequence] = useState(null);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(null); // null = still checking
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVerified(d ? !!d.email_verified_send : false))
      .catch(() => setVerified(false));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleFile(file) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setError("That's not a PDF. Pick a PDF or enter the quote manually.");
      return;
    }
    setError("");
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quotes/parse", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Could not read the PDF.");
      const { fields } = await res.json();
      setForm({
        ...emptyForm,
        ...fields,
        amount: fields.amount === "" || fields.amount == null ? "" : String(fields.amount),
        quote_date: fields.quote_date || emptyForm.quote_date,
      });
      setFromPdf(true);
      setStage("entry");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setParsing(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function submit() {
    if (!form.customer_email) {
      setError("Add a customer email — that's where follow-ups go.");
      setState("error");
      return;
    }
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setSequence(data.scheduled || data.sequence);
      setStage("done");
    } catch (err) {
      setError(String(err.message || err));
      setState("error");
    }
  }

  // ---- Not connected yet ----
  if (verified === false) {
    return (
      <div className="wrap">
        <div className="topbar">
          <div className="logo">Quote<span>Hound</span></div>
          <a className="btn" href="/">Dashboard</a>
        </div>
        <h1 className="page">New quote</h1>
        <div className="empty">
          <p style={{ marginBottom: 12, fontWeight: 600, color: "var(--ink)" }}>
            Connect your sending email first
          </p>
          <p style={{ marginBottom: 16 }}>
            QuoteHound sends follow-ups from your own email address. Connect and
            verify it before you start chasing quotes.
          </p>
          <a className="btn primary" href="/settings">Go to Settings</a>
        </div>
      </div>
    );
  }

  // ---- Sequence scheduled ----
  if (stage === "done") {
    return (
      <div className="wrap">
        <h1 className="page">Sequence scheduled</h1>
        <p style={{ marginBottom: 16 }}>
          QuoteHound will chase {form.customer_name.split(" ")[0]} with{" "}
          {sequence && sequence.length === 1 ? "this email" : `these ${sequence ? sequence.length : 3} emails`}.
          It stops the moment you mark the quote as responded.
        </p>
        {(sequence || []).map((e, i) => (
          <div key={i} className="quote active" style={{ whiteSpace: "pre-wrap" }}>
            <div className="quote-meta">Day {e.day} · subject: {e.subject}</div>
            <div style={{ marginTop: 6 }}>{e.body}</div>
          </div>
        ))}
        <a className="btn primary" href="/" style={{ display: "inline-block", marginTop: 10 }}>
          Back to dashboard
        </a>
      </div>
    );
  }

  // ---- Pick intake mode ----
  if (stage === "pick") {
    return (
      <div className="wrap">
        <div className="topbar">
          <div className="logo">Quote<span>Hound</span></div>
          <a className="btn" href="/">Dashboard</a>
        </div>
        <h1 className="page">New quote</h1>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !parsing && fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "var(--chase)" : "var(--line)"}`,
            background: dragOver ? "var(--chase-bg)" : "var(--card)",
            padding: "40px 20px", textAlign: "center", cursor: "pointer",
            borderRadius: 4,
          }}
        >
          <div style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 700, textTransform: "uppercase" }}>
            {parsing ? "Reading the quote…" : "Drop quote PDF"}
          </div>
          <div className="quote-meta" style={{ marginTop: 6 }}>
            {parsing
              ? "Claude is pulling out the customer, amount and details."
              : "Drag a PDF here or click to choose one. We read it, you confirm."}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}

        <p style={{ marginTop: 18, fontSize: 14 }}>
          Or{" "}
          <a
            href="#"
            style={{ fontWeight: 600 }}
            onClick={(e) => { e.preventDefault(); setForm(emptyForm); setFromPdf(false); setError(""); setStage("entry"); }}
          >
            enter it manually
          </a>
          .
        </p>
      </div>
    );
  }

  // ---- Entry / review form ----
  const emailMissing = fromPdf && !form.customer_email;
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="logo">Quote<span>Hound</span></div>
        <a className="btn" href="/">Dashboard</a>
      </div>
      <h1 className="page">{fromPdf ? "Review quote" : "New quote"}</h1>

      {fromPdf && (
        <p style={{ marginBottom: 16, fontSize: 14, color: "var(--ink-soft)" }}>
          Pulled from your PDF — check each field, then start chasing. Nothing
          sends until you confirm.
        </p>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Customer name
          <input value={form.customer_name} onChange={set("customer_name")} placeholder="Mike Tanaka" />
        </label>
        <label style={emailMissing ? { color: "var(--chase)" } : undefined}>
          Customer email {emailMissing && "· required — the PDF didn't include one"}
          <input
            type="email"
            value={form.customer_email}
            onChange={set("customer_email")}
            placeholder="mike@example.com"
            style={emailMissing ? { borderColor: "var(--chase)", background: "var(--chase-bg)" } : undefined}
            autoFocus={emailMissing}
          />
        </label>
        <label>
          Customer phone (optional)
          <input value={form.customer_phone} onChange={set("customer_phone")} placeholder="(808) 555-0100" />
        </label>
        <label>
          Quote amount ($)
          <input type="number" value={form.amount} onChange={set("amount")} placeholder="8400" />
        </label>
        <label>
          What the quote is for
          <input value={form.description} onChange={set("description")} placeholder="1,200 sqft SPC vinyl plank, Ewa Beach" />
        </label>
        <label>
          Date quote was sent
          <input type="date" value={form.quote_date} onChange={set("quote_date")} />
        </label>
        <label>
          Pricing holds until (optional)
          <input type="date" value={form.expires_on} onChange={set("expires_on")} />
        </label>
        {error && <p className="error">{error}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="primary" disabled={state === "saving"} onClick={submit}>
            {state === "saving" ? "Writing follow-ups…" : "Start chasing"}
          </button>
          <button type="button" disabled={state === "saving"} onClick={() => { setStage("pick"); setError(""); setState("idle"); }}>
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
