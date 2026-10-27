// Outgoing email, from EMAIL_FROM.
//   SMTP_HOST set      → sent through that mail server (e.g. the Hostinger mailbox affiliate@opengrowthofficial.com).
//   RESEND_API_KEY set → sent through Resend (https://resend.com).
//   neither            → not sent; printed to the server console and kept in the dev mailbox (/dev/mailbox).
// Sending never throws: a failed email must not undo a signup or an approval. Every attempt is recorded.

import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";

export type EmailKind = "email_code" | "password_code" | "approved" | "declined" | "welcome";

const FROM = process.env.EMAIL_FROM || "Opengrowth <no-reply@opengrowth.local>";

export const emailConfigured = () => !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY);

let smtp: Transporter | null = null;
function smtpTransport() {
  const port = Number(process.env.SMTP_PORT) || 465;
  smtp ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL from the start; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
  });
  return smtp;
}

/** Sends one message; returns the provider's message id. */
async function deliver(msg: { to: string; subject: string; text: string }): Promise<string | null> {
  if (process.env.SMTP_HOST) {
    const info = await smtpTransport().sendMail({ from: FROM, to: msg.to, subject: msg.subject, text: msg.text, html: html(msg.text) });
    return info.messageId ?? null;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: html(msg.text) }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(data.message || `Resend answered ${res.status}`);
  return data.id ?? null;
}

/** Absolute link for emails (they're read outside the app, so relative paths don't work). */
export function appLink(path: string): string {
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

function html(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="background:#0a0a0b;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid #26262a;border-radius:14px;padding:28px;color:#f2f0ea">
    <div style="color:#d4af5a;font-weight:bold;letter-spacing:3px;font-size:13px;margin-bottom:20px">OPENGROWTH · BY YOUNG MONEY</div>
    ${body}
  </div>
</div>`;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; kind: EmailKind }): Promise<{ ok: boolean }> {
  if (!emailConfigured()) {
    console.log(`[email] (not sent: no SMTP_HOST or RESEND_API_KEY) to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`);
    await db.emailMessage.create({ data: { to: msg.to, kind: msg.kind, subject: msg.subject, status: "logged", body: msg.text } }).catch(() => {});
    return { ok: true };
  }

  try {
    const providerId = await deliver(msg);
    await db.emailMessage.create({ data: { to: msg.to, kind: msg.kind, subject: msg.subject, status: "sent", providerId } });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[email] failed to=${msg.to} subject="${msg.subject}": ${error}`);
    await db.emailMessage.create({ data: { to: msg.to, kind: msg.kind, subject: msg.subject, status: "failed", error } }).catch(() => {});
    return { ok: false };
  }
}

// ---------- The messages ----------

export function emailCodeMessage(to: string, code: string) {
  return sendEmail({
    to,
    kind: "email_code",
    subject: `${code} is your Opengrowth code`,
    text: `Your code to confirm this email address is:\n\n${code}\n\nIt works for 15 minutes. If you didn't sign up for Opengrowth, you can ignore this email.`,
  });
}

export function passwordCodeMessage(to: string, code: string) {
  return sendEmail({
    to,
    kind: "password_code",
    subject: `${code} is your Opengrowth password reset code`,
    text: `Someone asked to reset the password for this Opengrowth account. Your code is:\n\n${code}\n\nIt works for 15 minutes. If it wasn't you, ignore this email: your password stays the same.`,
  });
}

export function approvedMessage(to: string, name: string, code: string) {
  return sendEmail({
    to,
    kind: "approved",
    subject: "You're approved: your OG code is ready",
    text: `Hi ${name},\n\nYou're approved as an Opengrowth affiliate. Your code is ${code}.\n\nPlayers give this code when they join, or sign up with your link:\n${appLink(`/r/${code}`)}\n\nYou earn 5% of your players' gross profit, paid every Monday. Log in to see your dashboard:\n${appLink("/login")}`,
  });
}

export function declinedMessage(to: string, name: string) {
  return sendEmail({
    to,
    kind: "declined",
    subject: "About your Opengrowth application",
    text: `Hi ${name},\n\nWe couldn't approve your Opengrowth affiliate account. If you think this is a mistake, message your Young Money rep in the group chat.`,
  });
}

export function welcomeMessage(to: string, name: string, code: string) {
  return sendEmail({
    to,
    kind: "welcome",
    subject: "Your Opengrowth account is ready",
    text: `Hi ${name},\n\nThe team has set up your Opengrowth affiliate account. Your code is ${code}.\n\nLog in with this email address at ${appLink("/login")}. The team will give you a temporary password; change it on your profile after you log in.`,
  });
}
