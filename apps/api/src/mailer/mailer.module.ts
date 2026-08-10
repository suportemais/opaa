import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

type SendOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  fromName?: string;
};

@Global()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;
  private defaults: { from: string } | null = null;

  constructor(private readonly config: ConfigService) {}

  private createTransporter(): { transporter: Transporter; defaults: { from: string } } | null {
    const host = (this.config.get('SMTP_HOST') ?? '').trim();
    const port = Number(this.config.get('SMTP_PORT') ?? 1025);
    const secure = (this.config.get('SMTP_SECURE') ?? '').toLowerCase() === 'true';
    const user = (this.config.get('SMTP_USER') ?? '').trim();
    const pass = (this.config.get('SMTP_PASS') ?? '').trim();

    const defaultFrom = (this.config.get('SMTP_FROM') ?? '').trim() || 'no-reply@opiina.com.br';
    const defaultFromName = (this.config.get('SMTP_FROM_NAME') ?? '').trim() || 'Opiina';

    if (!host) {
      return null;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 5 * 1000,
      greetingTimeout: 5 * 1000,
      socketTimeout: 10 * 1000,
    });

    return {
      transporter,
      defaults: { from: `${defaultFromName} <${defaultFrom}>` },
    };
  }

  private ensure(): { transporter: Transporter; defaults: { from: string } } | null {
    if (this.transporter && this.defaults) return { transporter: this.transporter, defaults: this.defaults };
    const built = this.createTransporter();
    if (!built) return null;
    this.transporter = built.transporter;
    this.defaults = built.defaults;
    return built;
  }

  async testOrLog() {
    const built = this.ensure();
    if (!built) {
      this.logger.warn('SMTP_HOST não configurado: envio de e-mails desativado (forgot password não enviará nada fora do ambiente com SMTP).');
      return;
    }
    try {
      await built.transporter.verify();
      this.logger.log(`SMTP pronto via ${this.config.get('SMTP_HOST')}:${this.config.get('SMTP_PORT')} (from=${built.defaults.from}).`);
    } catch (e: any) {
      this.logger.warn(`SMTP configurado mas falhou no verify: ${e?.message ?? String(e)}`);
    }
  }

  async send(options: SendOptions): Promise<{ sent: boolean; info?: any; reason?: string }> {
    const built = this.ensure();
    if (!built) {
      this.logger.warn(`Envio de e-mail ignorado (SMTP_HOST não configurado): to=${options.to} subject=${options.subject}`);
      return { sent: false, reason: 'smtp_not_configured' };
    }

    try {
      const info = await built.transporter.sendMail({
        from: built.defaults.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      return { sent: true, info };
    } catch (e: any) {
      this.logger.error(`Falha ao enviar e-mail para ${options.to}: ${e?.message ?? String(e)}`);
      return { sent: false, reason: String(e?.message ?? 'smtp_error') };
    }
  }
}

@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule implements OnModuleInit {
  constructor(private readonly mailer: MailerService) {}

  async onModuleInit() {
    await this.mailer.testOrLog();
  }
}
