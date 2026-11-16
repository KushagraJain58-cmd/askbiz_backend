const { getOtpTransporter } = require("../../config/otpMailer");
const { otpEmailTemplate } = require("../../templates/otpEmailTemplate");
const { config } = require("../../../utils/config");

async function sendOtpEmail({ to, otp, name, purpose }) {
  const transporter = getOtpTransporter();

  await transporter.sendMail({
    from: `"AskBiz" <${config.smtp_user}>`,
    to,
    subject: "Your AskBiz verification code",
    html: otpEmailTemplate({ name, otp, purpose }),
  });
}

module.exports = { sendOtpEmail };
