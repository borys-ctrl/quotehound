"use client";

import { useState } from "react";

export default function NewQuote() {
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    amount: "",
    description: "",
    quote_date: new Date().toISOString().slice(0, 10),
  });
  const [state, setState] = useState("idle"); // idle | saving | done | error
  const [sequence, setSequence] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
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
      setSequence(data.sequence);
      setState("done");
    } catch (err) {
      setError(String(err.message || err));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="wrap">
        <h1 className="page">Sequence scheduled</h1>
        <p style={{ marginBottom: 16 }}>
          QuoteHound will chase {form.customer_name.split(" ")[0]} with these
          three emails. It stops the moment you mark the quote as responded.
        </p>
        {sequence.map((e, i) => (
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

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="logo">Quote<span>Hound</span></div>
        <a className="btn" href="/">Dashboard</a>
      </div>
      <h1 className="page">New quote</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Customer name
          <input value={form.customer_name} onChange={set("customer_name")} placeholder="Mike Tanaka" />
        </label>
        <label>
          Customer email
          <input type="email" value={form.customer_email} onChange={set("customer_email")} placeholder="mike@example.com" />
        </label>
        <label>
          Quote amount ($)
          <input type="number" value={form.amount} onChange={set("amount")} placeholder="8400" />
        </label>
        <label>
          What the quote is for (optional)
          <input value={form.description} onChange={set("description")} placeholder="1,200 sqft SPC vinyl plank, Ewa Beach" />
        </label>
        <label>
          Date quote was sent
          <input type="date" value={form.quote_date} onChange={set("quote_date")} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={state === "saving"} onClick={submit}>
          {state === "saving" ? "Writing follow-ups…" : "Start chasing"}
        </button>
      </form>
    </div>
  );
}
