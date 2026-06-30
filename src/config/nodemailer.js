var nodemailer = require('nodemailer');
var config = require('../../utils/config').config;

var mail_email = config.mail_email;
var mail_password = config.mail_password;

var transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: mail_email,
      pass: mail_password,
    },
    tls: {
      rejectUnauthorized: false
    }
});

module.exports = transporter;
