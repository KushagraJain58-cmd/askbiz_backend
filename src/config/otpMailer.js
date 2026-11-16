const nodemailer = require("nodemailer");
const { config } = require("../../utils/config");

let otpTransporter = null;

function getOtpTransporter() {
  if (!otpTransporter) {
    otpTransporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
    });
  }
  return otpTransporter;
}

module.exports = { getOtpTransporter };
