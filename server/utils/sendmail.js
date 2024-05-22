const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});
async function sendMail({ from, to, subject, text, html }) {
  try {
    const res = await transporter.sendMail({
      from: 'noreply@borrowbe.com',
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
module.exports = sendMail;
