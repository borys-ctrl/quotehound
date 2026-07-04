"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 380, paddingTop: 80 }}>
      <div className="logo" style={{ marginBottom: 24 }}>
        Quote<span>Hound</span>
      </div>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
      </label>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      <button className="primary" style={{ marginTop: 14, width: "100%" }} onClick={submit}>
        Log in
      </button>
    </div>
  );
}
