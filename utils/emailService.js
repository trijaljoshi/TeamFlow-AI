const { sendEmail } = require("./emailService");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

async function sendEventEmail({ to, name, subject, intro, details = [] }) {
  if (!to) return;
  const rows = details.map(([label, value]) =>
    `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || "—")}</p>`
  ).join("");
  try {
    await sendEmail({
      to,
      name: name || "",
      subject,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#0f172a"><h2 style="color:#0d9488">TeamFlow AI</h2><p>Hi ${escapeHtml(name || "there")},</p><p>${escapeHtml(intro)}</p>${rows}<p>Regards,<br><strong>TeamFlow AI</strong></p></div>`
    });
  } catch (error) {
    // Email is best-effort; never fail the underlying task/QA/ticket action.
    console.error("Event email failed:", subject, error?.message || error);
  }
}

module.exports = { sendEventEmail };