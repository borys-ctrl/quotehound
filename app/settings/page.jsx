"use client";

import { useEffect, useState } from "react";

const PROVIDERS = {
  gmail: {
    label: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    help: (
      <>
        Turn on 2-Step Verification, then create an{" "}
        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
          App Password
        </a>{" "}
        for "Mail". Use that 16-character password below (not your normal Gmail password).
      </>
    ),
  },
  zoho: {
    label: "Zoho",
    host: "smtp.zoho.com",
    port: 465,
    help: (
      <>
        Zoho Mail → My Account → Security →{" "}
        <a href="https://accounts.zoho.com/home#security/apppasswords" target="_blank" rel="noreferrer">
          App Passwords
        </a>{" "}
        → generate one for "QuoteHound". Paste it below.
      </>
    ),
  },
  outlook: {
    label: "Outlook",
    host: "smtp.office365.com",
    port: 587,
    help: (
      <>
        With 2-Step Verification on, create an{" "}
        <a href="https://account.microsoft.com/security" target="_blank" rel="noreferrer">
          app password
        </a>{" "}
        under Microsoft account → Security → Advanced security options. Use it below.
      </>
    ),
  },
  custom: {
    label: "Custom",
    host: "",
    port: 465,
    help: (
      <>Enter your provider's SMTP host and port. Use an app-specific password if they offer one.</>
    ),
  },
};

function detectProvider(host) {
  for (const [key, p] of Object.entries(PROVIDERS)) {
    if (p.host && p.host === host) return key;
  }
  return host ? "custom" : "gmail";
}

export default function Settings() {
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({
    email: "",
    sender_name: "",
    business_name: "",
    business_phone: "",
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_user: "",
    smtp_pass: "",
  });
  const [provider, setProvider] = useState("gmail");
  const [connected, setConnected] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sendVia, setSendVia] = useState("smtp");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const isGoogle = sendVia === "gmail_api";

  async function load() {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const d = await res.json();
    setForm((f) => ({
      ...f,
      email: d.email,
      sender_name: d.sender_name,
      business_name: d.business_name,
      business_phone: d.business_phone,
      smtp_host: d.smtp_host || "smtp.gmail.com",
      smtp_port: d.smtp_port || 465,
      smtp_user: d.smtp_user,
      smtp_pass: "",
    }));
    setProvider(detectProvider(d.smtp_host));
    setConnected(d.smtp_connected);
    setVerified(d.email_verified_send);
    setSendVia(d.send_via || "smtp");
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function pickProvider(e) {
    const key = e.target.value;
    setProvider(key);
    const p = PROVIDERS[key];
    if (key !== "custom") {
      setForm((f) => ({ ...f, smtp_host: p.host, smtp_port: p.port }));
    }
  }

  async function save() {
    setError("");
    setMsg("");
    setBusy("save");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      const d = await res.json();
      setVerified(d.email_verified_send);
      if (form.smtp_pass) setConnected(true);
      setForm((f) => ({ ...f, smtp_pass: "" }));
      setMsg("Settings saved.");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy("");
    }
  }

  async function testSend() {
    setError("");
    setMsg("");
    setBusy("test");
    try {
      // Save first so the latest credentials are stored before we test them.
      const saveRes = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!saveRes.ok) throw new Error((await saveRes.json()).error || "Save failed");
      if (form.smtp_pass) setConnected(true);
      setForm((f) => ({ ...f, smtp_pass: "" }));

      const res = await fetch("/api/settings/test-send", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Test send failed");
      setVerified(true);
      setMsg(`Test email sent to ${form.email}. Check your inbox — you're connected.`);
    } catch (err) {
      setVerified(false);
      setError(String(err.message || err));
    } finally {
      setBusy("");
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (!loaded) {
    return (
      <div className="wrap">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="logo">Quote<span>Hound</span></div>
        <a className="btn" href="/">Dashboard</a>
      </div>

      <h1 className="page">Settings</h1>

      <div
        className={`quote ${verified ? "responded" : "active"}`}
        style={{ marginBottom: 20 }}
      >
        {isGoogle ? (
          <>
            <div className="quote-name">
              {verified
                ? `Connected as ${form.email} via Google`
                : "Google access needs reconnecting"}
            </div>
            <div className="quote-meta">
              {verified
                ? "Follow-ups send straight from your Gmail — no SMTP setup needed."
                : "Your Google access was revoked. Reconnect to resume sending."}
            </div>
            <div style={{ marginTop: 10 }}>
              <a className="btn primary" href="/api/auth/google">
                {verified ? "Reconnect Google" : "Reconnect Google"}
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="quote-name">
              {verified
                ? `Connected as ${form.smtp_user || form.email}`
                : connected
                ? "Sending email saved — send a test to verify"
                : "Sending email not connected yet"}
            </div>
            <div className="quote-meta">
              {verified
                ? "Follow-ups will send from this address."
                : "You can't start chasing quotes until a test send succeeds."}
            </div>
          </>
        )}
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Your name (sender)
          <input value={form.sender_name} onChange={set("sender_name")} placeholder="Borys" />
        </label>
        <label>
          Business name
          <input value={form.business_name} onChange={set("business_name")} placeholder="Best Flooring Honolulu" />
        </label>
        <label>
          Business phone
          <input value={form.business_phone} onChange={set("business_phone")} placeholder="(808) 555-0100" />
        </label>

        {!isGoogle && (
          <>
            <label>
              Email provider
              <select
                value={provider}
                onChange={pickProvider}
                style={{
                  width: "100%", padding: "10px 12px", fontFamily: "var(--body)",
                  fontSize: 15, border: "1px solid var(--line)", borderRadius: 4,
                  background: "var(--card)", marginTop: 4,
                }}
              >
                {Object.entries(PROVIDERS).map(([k, p]) => (
                  <option key={k} value={k}>{p.label}</option>
                ))}
              </select>
            </label>

            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: -6 }}>
              {PROVIDERS[provider].help}
            </p>

            <label>
              SMTP host
              <input value={form.smtp_host} onChange={set("smtp_host")} placeholder="smtp.gmail.com" />
            </label>
            <label>
              SMTP port
              <input type="number" value={form.smtp_port} onChange={set("smtp_port")} placeholder="465" />
            </label>
            <label>
              SMTP username (the address follow-ups send from)
              <input value={form.smtp_user} onChange={set("smtp_user")} placeholder="sales@bestflooringhonolulu.com" />
            </label>
            <label>
              SMTP app password
              <input
                type="password"
                value={form.smtp_pass}
                onChange={set("smtp_pass")}
                placeholder={connected ? "•••••••• (leave blank to keep current)" : "app-specific password"}
              />
            </label>
          </>
        )}

        {error && <p className="error">{error}</p>}
        {msg && <p style={{ color: "var(--won)", fontSize: 13 }}>{msg}</p>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="primary" disabled={busy !== ""} onClick={save}>
            {busy === "save" ? "Saving…" : "Save settings"}
          </button>
          <button disabled={busy !== ""} onClick={testSend}>
            {busy === "test" ? "Sending test…" : "Send test email"}
          </button>
        </div>
      </form>

      <p style={{ marginTop: 28, fontSize: 13 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} style={{ fontWeight: 600 }}>
          Log out
        </a>
      </p>
    </div>
  );
}
