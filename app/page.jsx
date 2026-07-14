// Public landing page. Logged-in visitors are redirected to /dashboard by
// middleware, so this is only ever shown to signed-out users.

const steps = [
  {
    n: "1",
    title: "Sign in with Google",
    body: "One click. We send follow-ups from your own email — never a QuoteHound address.",
  },
  {
    n: "2",
    title: "Drop your quote PDF",
    body: "AI reads the customer, the amount, and the details straight off your quote.",
  },
  {
    n: "3",
    title: "Approve the follow-ups",
    body: "We send them over the next weeks and stop the moment they reply.",
  },
];

export default function Landing() {
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="logo">Quote<span>Hound</span></div>
        <a className="btn" href="/login">Log in</a>
      </div>

      <h1
        style={{
          fontFamily: "var(--display)", fontWeight: 700,
          fontSize: "clamp(30px, 6vw, 46px)", lineHeight: 1.05,
          textTransform: "uppercase", letterSpacing: "0.5px",
          margin: "18px 0 14px",
        }}
      >
        Every quote deserves an answer.
      </h1>
      <p style={{ fontSize: 18, color: "var(--ink-soft)", maxWidth: 560, marginBottom: 10 }}>
        QuoteHound chases your unanswered quotes until they reply.
      </p>
      <p style={{ fontSize: 15, color: "var(--ink-soft)", maxWidth: 560, marginBottom: 28 }}>
        Your first 5 quotes are free. After that, $29/month — one recovered job
        pays for years of it.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
        <a
          className="btn primary"
          href="/api/auth/google"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 16, padding: "12px 22px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
            <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
          </svg>
          Continue with Google
        </a>
        <a className="btn" href="/login" style={{ fontSize: 16, padding: "12px 22px" }}>
          Log in
        </a>
      </div>

      <h2
        style={{
          fontFamily: "var(--display)", fontWeight: 700, fontSize: 15,
          textTransform: "uppercase", letterSpacing: "1.5px",
          color: "var(--ink-soft)", marginBottom: 14,
        }}
      >
        How it works
      </h2>
      <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
        {steps.map((s) => (
          <div key={s.n} className="quote active" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div
              style={{
                fontFamily: "var(--display)", fontWeight: 700, fontSize: 28,
                lineHeight: 1, color: "var(--chase)", minWidth: 24,
              }}
            >
              {s.n}
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
              <div className="quote-meta" style={{ marginTop: 0 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderLeft: "4px solid var(--ink)", background: "var(--card)",
          border: "1px solid var(--line)", borderLeftWidth: 4,
          borderLeftColor: "var(--ink)", padding: "14px 16px", marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>What you need</div>
        <div className="quote-meta" style={{ marginTop: 0 }}>
          A Gmail account and your quote PDFs — nothing else.
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--ink-soft)", maxWidth: 560 }}>
        Emails come from your own address, so replies land in your inbox like any
        other message. QuoteHound only sends the follow-ups you approve — it never
        reads your inbox.
      </p>
    </div>
  );
}
