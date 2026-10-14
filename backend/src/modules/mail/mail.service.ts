import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initMailers();
  }

  private initMailers() {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const configuredPass = this.configService.get<string>('SMTP_PASS');
    const smtpHost = this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPass = smtpHost === 'smtp.gmail.com' ? configuredPass?.replace(/\s/g, '') : configuredPass;
    const smtpPort = Number(this.configService.get<string>('SMTP_PORT') || 465);
    if (![465, 587].includes(smtpPort)) throw new Error('SMTP_PORT must be 465 or 587.');

    if (smtpUser && smtpPass) {
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for 587
        requireTLS: smtpPort === 587,
        connectionTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('SMTP mailer configured.');
    } else {
      this.logger.warn(
        'SMTP credentials not configured; reset emails cannot be delivered.',
      );
    }
  }

  private getLogoAttachment(): { filename: string; path: string; cid: string } | null {
    const possiblePaths = [
      path.join(process.cwd(), 'assets', 'google_developers_logomark.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'google_developers_logomark.png'),
      path.join(__dirname, '..', '..', 'assets', 'google_developers_logomark.png'),
      path.join(process.cwd(), '..', 'FE', 'public', 'google_developers_logomark.png'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return {
          filename: 'gdgoc-logo.png',
          path: p,
          cid: 'gdgoc-logo',
        };
      }
    }
    return null;
  }

  async sendPasswordResetEmail(
    to: string,
    recipientName: string,
    resetUrl: string,
  ): Promise<boolean> {
    if (!this.smtpTransporter) return false;
    const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
    const safeResetUrl = escape(resetUrl);
    const fromAddress =
      this.configService.get<string>('SMTP_FROM') ||
      { name: 'GDG on Campus FPTU HCMC', address: this.configService.get<string>('SMTP_USER')! };

    const name = escape(recipientName || 'Thành viên GDGoC');
    const logoAttachment = this.getLogoAttachment();
    const frontendUrl =
      this.configService.get<string>('APP_FRONTEND_URL') ||
      'http://localhost:3000';
    const logoSrc = escape(logoAttachment ? 'cid:gdgoc-logo' : `${frontendUrl}/google_developers_logomark.png`);

    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Đặt lại mật khẩu - GDGoC FPTU OS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
          
          <!-- Google 4-Color Accent Bar -->
          <tr>
            <td style="padding: 0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="height: 6px; border-collapse: collapse;">
                <tr>
                  <td width="25%" style="background-color: #4285F4; height: 6px;"></td>
                  <td width="25%" style="background-color: #EA4335; height: 6px;"></td>
                  <td width="25%" style="background-color: #FBBC04; height: 6px;"></td>
                  <td width="25%" style="background-color: #34A853; height: 6px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header Section with GDG Branding -->
          <tr>
            <td style="padding: 32px 36px 20px 36px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <!-- GDG Emblem with Official Logo -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 14px;">
                          <img src="${logoSrc}" width="52" height="26" alt="GDGoC Logo" style="display: block; width: 52px; max-width: 52px; height: auto; border: 0; outline: none;" />
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            GDG ON CAMPUS
                          </div>
                          <div style="font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            FPT University HCMC • GDGoC FPTU OS
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #1e40af; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9999px;">
                      Security Portal
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="height: 1px; background-color: #f1f5f9; width: 100%;"></div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 36px 32px 36px;">
              <div style="margin-bottom: 8px;">
                <span style="display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #4285F4; background-color: #eff6ff; padding: 4px 10px; border-radius: 6px;">
                  Khôi phục tài khoản
                </span>
              </div>
              <h1 style="margin: 8px 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3; letter-spacing: -0.3px;">
                Yêu Cầu Đặt Lại Mật Khẩu
              </h1>
              
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Xin chào <strong style="color: #0f172a;">${name}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Hệ sinh thái quản trị <strong>GDGoC FPTU OS</strong> vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này. Để thiết lập mật khẩu mới an toàn, vui lòng bấm vào nút bên dưới:
              </p>

              <!-- CTA Button Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeResetUrl}" target="_blank" style="display: inline-block; background-color: #4285F4; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(66, 133, 244, 0.35); letter-spacing: 0.3px; mso-padding-alt: 0; text-align: center;">
                      <!--[if mso]><i style="letter-spacing: 36px; mso-font-width: -100%; mso-text-raise: 28pt">&nbsp;</i><![endif]-->
                      <span style="mso-text-raise: 14pt;">Đặt Lại Mật Khẩu Ngay</span>
                      <!--[if mso]><i style="letter-spacing: 36px; mso-font-width: -100%">&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; margin: 24px 0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="28" style="vertical-align: top; font-size: 18px; line-height: 1;">
                          ⏰
                        </td>
                        <td style="vertical-align: top; padding-left: 10px;">
                          <div style="font-size: 13px; font-weight: 800; color: #92400e; margin-bottom: 4px;">
                            Thời hạn liên kết: 15 phút
                          </div>
                          <div style="font-size: 12px; line-height: 1.5; color: #b45309;">
                            Vì lý do bảo mật, liên kết này chỉ có thể sử dụng <strong>1 lần duy nhất</strong>. Sau 15 phút, liên kết sẽ tự động hết hạn.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link Section -->
              <p style="margin: 24px 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                Nếu nút bấm ở trên không hoạt động, bạn có thể sao chép và dán trực tiếp đường dẫn bên dưới vào trình duyệt:
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-family: monospace; font-size: 11px; color: #2563eb; word-break: break-all; line-height: 1.5;">
                <a href="${safeResetUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">${safeResetUrl}</a>
              </div>

              <!-- Disclaimer -->
              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.6; color: #94a3b8;">
                Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email. Mật khẩu tài khoản của bạn vẫn được bảo vệ an toàn và không có bất kỳ thay đổi nào.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #475569;">
                Google Developer Groups on Campus • FPT University HCMC
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Hệ sinh thái số phục vụ vận hành và gắn kết cộng đồng thành viên GDGoC FPTU OS.<br/>
                Email này được gửi tự động, vui lòng không trả lời trực tiếp email này.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    if (this.smtpTransporter) {
      try {
        const mailOptions: nodemailer.SendMailOptions = {
          from: fromAddress,
          to,
          subject: '[GDGoC FPTU OS] Yêu cầu đặt lại mật khẩu tài khoản',
          html: htmlContent,
          text: `Xin chào ${recipientName || 'Thành viên GDGoC'}, đặt lại mật khẩu tại ${resetUrl}. Liên kết hết hạn sau 15 phút.`,
        };

        if (logoAttachment) {
          mailOptions.attachments = [logoAttachment];
        }

        const result = await this.smtpTransporter.sendMail(mailOptions);
        return result.accepted?.some(address => typeof address === 'string' && address.toLowerCase() === to.toLowerCase()) || false;
      } catch (error) {
        this.logger.error('SMTP delivery failed; reset token will be invalidated.');
        return false;
      }
    }

    return false;
  }
}
