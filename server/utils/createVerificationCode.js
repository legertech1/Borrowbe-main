const memo = require("../memo");
const sendMail = require("./sendmail");

module.exports = function (user, subject, email) {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  memo.setVerificationCode(user._id, code, subject, email);
  sendMail({
    from: "noreply@borrowbe.com",
    to: email,
    subject: "Verification code " + subject,
    html: createEmailHtml({
      content: `<p>Use the verification code provided below to ${subject}</p>
      <p class="code">${code}</p>
      <p>This code is valid for 5 minutes</p>
      <p class="light">* if you did not request this code , we strongly recommend you reset your password.</p>`,
      heading: "Verification code " + subject,
    }),
  });
};
