import nodemailer from "nodemailer";

// Build a transporter from a single user's SMTP settings.
// Port 465 = implicit TLS (secure); 587 = STARTTLS (secure:false).
export function makeTransport({ host, port, user, pass }) {
  const p = Number(port) || 465;
  return nodemailer.createTransport({
    host,
    port: p,
    secure: p === 465,
    auth: { user, pass },
  });
}

// Sends one message from the user's own address; replies land in their inbox.
export async function sendMail(transporter, { fromName, fromEmail, to, subject, body }) {
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: body,
  });
}
