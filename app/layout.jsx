import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://quotehound.app"),
  title: "QuoteHound — Follow up on every quote until it answers",
  description:
    "QuoteHound chases your unanswered quotes with follow-up emails sent from your own Gmail — and stops the moment the customer replies.",
  openGraph: {
    title: "QuoteHound — Every quote deserves an answer",
    description:
      "Automatic follow-ups on your unanswered quotes, sent from your own email. First 5 quotes free.",
    url: "https://quotehound.app",
    siteName: "QuoteHound",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "QuoteHound — Every quote deserves an answer",
    description:
      "Automatic follow-ups on your unanswered quotes, sent from your own email. First 5 quotes free.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script defer src="/_vercel/insights/script.js"></script>
      </body>
    </html>
  );
}
