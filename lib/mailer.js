import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Sends from the contractor's real address; replies land in their normal inbox.
export async function sendFollowup({ to, subject, body }) {
  await transporter.sendMail({
    from: `"${process.env.SENDER_NAME} - ${process.env.BUSINESS_NAME}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: body,
  });
}
