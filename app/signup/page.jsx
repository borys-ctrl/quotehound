"use client";

import { useState } from "react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        // New accounts land on Settings to connect their sending email.
        window.location.href = "/settings";
      } else {
        setError((await res.json()).error || "Could not create account.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
      <div className="logo" style={{ marginBottom: 24 }}>
        Quote<span>Hound</span>
      </div>
      <h1 className="page">Create account</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--ink-soft)" }}>
        Already have an account? <a href="/login" style={{ fontWeight: 600 }}>Log in</a>
      </p>
    </div>
  );
}
