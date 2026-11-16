function otpEmailTemplate({ name, otp, purpose = "verify your email address" }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #0B1119;
          font-family: Arial, Helvetica, sans-serif;
        }
        .wrapper {
          width: 100%;
          padding: 32px 16px;
          background-color: #0B1119;
        }
        .card {
          max-width: 480px;
          margin: 0 auto;
          background-color: #131B26;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          overflow: hidden;
        }
        .header {
          padding: 28px 32px 0;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          color: #C9A45C;
          letter-spacing: 0.5px;
        }
        .tagline {
          margin-top: 4px;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #8A97A6;
        }
        .body {
          padding: 24px 32px 32px;
          color: #EEF2F7;
        }
        .greeting {
          font-size: 16px;
          margin: 0 0 8px;
        }
        .message {
          font-size: 13px;
          line-height: 1.6;
          color: #AEBCCB;
          margin: 0 0 24px;
        }
        .otp-box {
          text-align: center;
          background-color: rgba(201,164,92,0.1);
          border: 1px solid rgba(201,164,92,0.35);
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 24px;
        }
        .otp-code {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: 10px;
          color: #C9A45C;
        }
        .expiry {
          font-size: 12px;
          color: #8A97A6;
          text-align: center;
          margin: 0 0 24px;
        }
        .footer {
          font-size: 12px;
          line-height: 1.6;
          color: #8A97A6;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-top: 16px;
        }
        .footer a {
          color: #C9A45C;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="header">
            <div class="logo">askbiz</div>
            <div class="tagline">Build . Bond . Boost</div>
          </div>
          <div class="body">
            <p class="greeting">Hi${name ? ` ${name}` : ""},</p>
            <p class="message">
              Use the code below to ${purpose}. This code is valid for the next 5 minutes —
              do not share it with anyone.
            </p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <p class="expiry">Expires in 5 minutes</p>
            <div class="footer">
              <p style="margin:0 0 4px;">If you didn't request this, you can safely ignore this email.</p>
              <p style="margin:0;">Need help? Reach us at <a href="mailto:support@askbizz.com">support@askbizz.com</a></p>
              <p style="margin:12px 0 0;">— The AskBiz Team</p>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { otpEmailTemplate };
