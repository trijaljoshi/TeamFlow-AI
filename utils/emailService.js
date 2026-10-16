const { BrevoClient } = require("@getbrevo/brevo");

const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
});

const sendEmail = async ({
    to,
    name,
    subject,
    htmlContent,
}) => {
    try {
        const result =
            await brevo.transactionalEmails.sendTransacEmail({
                sender: {
                    email: process.env.BREVO_SENDER_EMAIL,
                    name:
                        process.env.BREVO_SENDER_NAME ||
                        "TeamFlow AI",
                },

                to: [
                    {
                        email: to,
                        name: name || "",
                    },
                ],

                subject,

                htmlContent,
            });

        console.log(
            `Email sent successfully to ${to}`
        );

        return result;

    } catch (error) {
        console.error(
            "Brevo email error:",
            error?.message || error
        );

        throw error;
    }
};

module.exports = {
    sendEmail,
};