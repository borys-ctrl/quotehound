import "./globals.css";

export const metadata = {
  title: "QuoteHound",
  description: "Follow up on every quote until it answers.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
