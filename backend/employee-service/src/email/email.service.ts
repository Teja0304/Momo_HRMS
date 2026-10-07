import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendCredentialEmailOptions {
  toEmail: string;
  employeeName: string;
  officialEmail: string;
  username: string;
  temporaryPassword?: string;
  isPasswordReset?: boolean;
  roleName?: string;
}

export interface CredentialDeliveryResult {
  delivered: boolean;
  mode: 'smtp' | 'console';
  message: string;
  deliveredTo: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  public readonly isConfigured: boolean;

  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user: string;
  private readonly pass: string;
  private readonly fromName: string;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.host = process.env.SMTP_HOST || 'smtp.gmail.com';
    this.port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.secure = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    this.user = process.env.SMTP_USER || '';
    this.pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').replace(/\s+/g, '');
    this.fromName = process.env.SMTP_FROM_NAME || 'Momo HRMS';
    this.fromEmail = process.env.SMTP_FROM_EMAIL || this.user;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    this.isConfigured = Boolean(this.host && this.port && this.user && this.pass);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.secure,
        auth: {
          user: this.user,
          pass: this.pass,
        },
      });
    }
  }

  async onModuleInit() {
    if (this.isConfigured && this.transporter) {
      try {
        await this.transporter.verify();
        this.logger.log(`SMTP transport initialized & verified with ${this.host}:${this.port} (${this.user})`);
      } catch (err: any) {
        this.logger.warn(`SMTP transport verification failed: ${err.message}`);
      }
    } else {
      this.logger.warn('SMTP not fully configured; credential emails will be simulated to console.');
    }
  }

  get fromAddress(): string {
    return `"${this.fromName}" <${this.fromEmail}>`;
  }

  /**
   * Send account credentials or password reset email via SMTP.
   */
  async sendCredentialEmail(options: SendCredentialEmailOptions): Promise<CredentialDeliveryResult> {
    const {
      toEmail,
      employeeName,
      officialEmail,
      username,
      temporaryPassword,
      isPasswordReset = false,
      roleName = 'EMPLOYEE',
    } = options;

    const isWebAdminOrHr =
      roleName.toUpperCase().includes('ADMIN') ||
      roleName.toUpperCase().includes('HR') ||
      roleName.toUpperCase().includes('MANAGER');

    const loginUrl = `${this.frontendUrl}/login`;

    const subject = isPasswordReset
      ? 'Your Momo HRMS Password Has Been Reset'
      : isWebAdminOrHr
      ? 'Welcome to Momo HRMS – Admin & HR Management Portal Credentials'
      : 'Welcome to Momo HRMS – Mobile App Login Credentials';

    const textContent = `
Hello ${employeeName},

${
  isPasswordReset
    ? 'An administrator has reset your password for Momo HRMS.'
    : isWebAdminOrHr
    ? 'Your administrative account has been created for the Momo HRMS Web Management Portal.'
    : 'Your employee account has been created for the Momo HRMS Mobile Application.'
}

------------------------------------------
LOGIN CREDENTIALS:
------------------------------------------
Role:                ${roleName}
Login Email:         ${officialEmail}
Username:            ${username}
${temporaryPassword ? `Temporary Password:  ${temporaryPassword}\n` : ''}------------------------------------------

${
  isWebAdminOrHr
    ? `Sign in to the web management portal using your browser at:\n${loginUrl}`
    : `ACCESS POLICY NOTICE:\n• Web portal access is reserved exclusively for Admin & HR staff.\n• Standard employees must sign in using the Momo HRMS Mobile App on Android or iOS.\n• Please download or open the mobile app on your smartphone to clock attendance and view your profile.`
}

IMPORTANT SECURITY NOTICE:
You are required to change your temporary password upon your first login. Please do not share these credentials with anyone.

Best regards,
Momo HRMS Team
`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b; }
    .card { background-color: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .badge-web { background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-mobile { background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .creds-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .cred-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .cred-row:last-child { margin-bottom: 0; }
    .cred-label { font-weight: 600; color: #475569; }
    .cred-value { font-family: monospace; font-size: 15px; color: #0f172a; font-weight: 700; background: #e2e8f0; padding: 2px 8px; border-radius: 4px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 6px; margin: 16px 0; }
    .alert-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; font-size: 13px; color: #92400e; margin: 20px 0; border-radius: 0 4px 4px 0; }
    .mobile-notice { background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 14px 16px; font-size: 13px; color: #065f46; margin: 20px 0; border-radius: 0 4px 4px 0; }
    .step-box { background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px dashed #cbd5e1; }
    .step-box ol { margin: 8px 0 0 20px; padding: 0; }
    .step-box li { margin-bottom: 6px; font-size: 13px; color: #334155; }
    .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">${
        isPasswordReset
          ? 'Password Reset Notice'
          : isWebAdminOrHr
          ? 'Welcome to Momo HRMS Admin & HR Portal'
          : 'Welcome to Momo HRMS'
      }</h1>
      <div class="subtitle">Smart Employee Attendance & Management System</div>
      <div class="badge ${isWebAdminOrHr ? 'badge-web' : 'badge-mobile'}">
        ${isWebAdminOrHr ? '💻 Web Management Portal Access' : '📱 Mobile App Access Only'}
      </div>
    </div>
    <p>Hello <strong>${employeeName}</strong>,</p>
    <p>${
      isPasswordReset
        ? 'Your account password has been reset by an administrator.'
        : isWebAdminOrHr
        ? 'Your administrative account has been provisioned. You can sign in to the Web Management Portal using the credentials below:'
        : 'Your employee account has been provisioned for the Momo HRMS Mobile Application. Please use the credentials below to log in:'
    }</p>

    <div class="creds-box">
      <div class="cred-row">
        <span class="cred-label">Role:</span>
        <span class="cred-value">${roleName}</span>
      </div>
      <div class="cred-row">
        <span class="cred-label">Login Email:</span>
        <span class="cred-value">${officialEmail}</span>
      </div>
      <div class="cred-row">
        <span class="cred-label">Username:</span>
        <span class="cred-value">${username}</span>
      </div>
      ${
        temporaryPassword
          ? `<div class="cred-row">
               <span class="cred-label">Temporary Password:</span>
               <span class="cred-value">${temporaryPassword}</span>
             </div>`
          : ''
      }
    </div>

    <div class="alert-box">
      <strong>Important:</strong> You must change this temporary password upon your first sign in before accessing the system.
    </div>

    ${
      isWebAdminOrHr
        ? `<div style="text-align: center;">
             <a href="${loginUrl}" class="btn" target="_blank">Sign In to Admin & HR Portal</a>
           </div>`
        : `<div class="mobile-notice">
             <strong>Platform Policy:</strong> Web browser access is reserved for Admin & HR staff. Standard employees must log in exclusively via the <strong>Momo HRMS Mobile App</strong> (Android / iOS).
           </div>
           <div class="step-box">
             <strong>How to Sign In:</strong>
             <ol>
               <li>Open the Momo HRMS App on your mobile smartphone.</li>
               <li>Sign in with your Login Email or Username and the Temporary Password above.</li>
               <li>You will immediately be guided to set your permanent secure password.</li>
             </ol>
           </div>`
    }

    <div class="footer">
      This is an automated system email from Momo HRMS. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
`;

    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.fromAddress,
          to: toEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });

        this.logger.log(`Credentials email sent to ${toEmail} (messageId: ${info.messageId})`);
        return {
          delivered: true,
          mode: 'smtp',
          message: `Credentials email dispatched via SMTP to ${toEmail}`,
          deliveredTo: toEmail,
        };
      } catch (err: any) {
        this.logger.error(`SMTP delivery failed to ${toEmail}: ${err.message}`, err.stack);
        throw err;
      }
    } else {
      this.logger.log(`SMTP not configured. Simulating credential dispatch to ${toEmail}`);
      console.log('\n================== [CREDENTIAL EMAIL DISPATCH] ==================');
      console.log(`To:                 ${toEmail}`);
      console.log(`Subject:            ${subject}`);
      console.log(`Role:               ${roleName}`);
      console.log(`Official Email:     ${officialEmail}`);
      console.log(`Username:           ${username}`);
      if (temporaryPassword) {
        console.log(`Temporary Password: ${temporaryPassword}`);
      }
      console.log('=================================================================\n');

      return {
        delivered: true,
        mode: 'console',
        message: `Credentials printed to console for ${toEmail} (SMTP not configured)`,
        deliveredTo: toEmail,
      };
    }
  }

  /**
   * Diagnostic method to send a test email.
   */
  async sendTestEmail(toEmail?: string) {
    const recipient = toEmail || this.fromEmail || this.user;
    if (!this.isConfigured || !this.transporter) {
      return {
        success: false,
        error: 'SMTP is not configured in .env',
        configured: false,
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: recipient,
        subject: 'Momo HRMS - SMTP Test Verification',
        text: 'This is a test email verifying that SMTP email delivery is operating correctly in Momo HRMS Employee Service.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb;">Momo HRMS SMTP Test</h2>
            <p>Your SMTP credentials configured in <code>backend/employee-service/.env</code> are working successfully!</p>
            <ul>
              <li><strong>Host:</strong> ${this.host}:${this.port}</li>
              <li><strong>From:</strong> ${this.fromAddress}</li>
              <li><strong>Recipient:</strong> ${recipient}</li>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
        `,
      });

      this.logger.log(`Test email dispatched to ${recipient} (messageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
        recipient,
        configured: true,
        message: `Test email sent successfully to ${recipient}`,
      };
    } catch (err: any) {
      this.logger.error(`Failed to send test email: ${err.message}`);
      return {
        success: false,
        error: err.message,
        recipient,
        configured: true,
      };
    }
  }
}
