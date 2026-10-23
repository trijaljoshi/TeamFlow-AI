
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendEmail({
  to,
  name = "",
  subject,
  htmlContent,
  textContent,
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "TeamFlow AI";

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is missing from environment variables");
  }

  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL is missing from environment variables");
  }

  if (!to || !subject || (!htmlContent && !textContent)) {
    throw new Error("Email recipient, subject, and content are required");
  }

  const recipients = (Array.isArray(to) ? to : [to]).map((recipient) => {
    if (typeof recipient === "string") {
      return { email: recipient };
    }

    return {
      email: recipient.email,
      ...(recipient.name ? { name: recipient.name } : {}),
    };
  });

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: recipients,
    subject,
    ...(htmlContent ? { htmlContent } : {}),
    ...(textContent ? { textContent } : {}),
  };

  // Add a recipient name when one is supplied.
  if (name && recipients.length === 1) {
    payload.to[0].name = name;
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Brevo email failed (${response.status}): ${responseText}`
    );
  }

  let result = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }
  }

  console.log("Email accepted by Brevo:", {
    to: recipients.map((recipient) => recipient.email),
    subject,
    messageId: result.messageId || null,
  });

  return result;
}

module.exports = { sendEmail };
