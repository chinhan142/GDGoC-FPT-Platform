import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecruitmentApplication } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecruitmentSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecruitmentSyncService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private verified?: { url: string; until: number };
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), 5000);
    this.timer.unref();
    void this.run();
  }
  onModuleDestroy() { this.stopped = true; if (this.timer) clearInterval(this.timer); }

  async run() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      for (let i = 0; i < 5 && !this.stopped; i++) {
        const token = randomUUID();
        const jobs = await this.prisma.$queryRaw<RecruitmentApplication[]>`
          UPDATE recruitment_applications SET "syncStatus" = 'PROCESSING',
            "leaseToken" = ${token}, "leaseUntil" = NOW() + INTERVAL '2 minutes',
            "syncAttempts" = "syncAttempts" + 1, "updatedAt" = NOW()
          WHERE id = (SELECT id FROM recruitment_applications
            WHERE ("syncStatus" = 'PENDING' AND "nextSyncAt" <= NOW())
              OR ("syncStatus" = 'PROCESSING' AND "leaseUntil" < NOW())
            ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING *`;
        if (!jobs.length) break;
        await this.sync(jobs[0], token);
      }
    } catch {
      this.logger.error('Recruitment worker unavailable; pending jobs remain in DB.');
    } finally { this.running = false; }
  }

  private async sync(job: RecruitmentApplication, token: string) {
    const url = this.config.get<string>('RECRUITMENT_APPS_SCRIPT_URL') || '';
    const secret = this.config.get<string>('RECRUITMENT_WEBHOOK_SECRET') || '';
    let code = 'NETWORK';
    let stage = 'configuration';
    try {
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) || secret.length < 32) {
        code = 'CONFIG'; throw new Error();
      }
      if (this.verified?.url !== url || this.verified.until <= Date.now()) {
        stage = 'protocol-fetch';
        const check = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
        if (!check.ok) { code = 'HTTP'; throw new Error(); }
        stage = 'protocol-json';
        const health = await check.json();
        if (health?.protocol !== 'gdgoc-recruitment-v2') { code = 'PROTOCOL'; throw new Error(); }
        this.verified = { url, until: Date.now() + 10 * 60_000 };
      }
      const payload = JSON.stringify({ ...(job.payload as object), candidateId: job.candidateId });
      const signature = createHmac('sha256', secret).update(payload).digest('hex');
      stage = 'sheet-post';
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ payload, signature }), redirect: 'follow', signal: AbortSignal.timeout(30_000) });
      if (!response.ok) { code = 'HTTP'; throw new Error(); }
      stage = 'sheet-json';
      const result = await response.json();
      if (result?.status !== 'success' || result.candidateId !== job.candidateId) {
        const known = ['CONFIG', 'UNAUTHORIZED', 'SCHEMA', 'BUSY', 'UNAVAILABLE', 'DUPLICATE', 'INVALID', 'CONFLICT'];
        code = known.includes(result?.code) ? result.code : 'PROTOCOL';
        throw new Error();
      }
      stage = 'db-confirm';
      await this.prisma.recruitmentApplication.updateMany({ where: { id: job.id, leaseToken: token }, data: {
        syncStatus: 'SYNCED', syncedAt: new Date(), syncError: null, leaseToken: null, leaseUntil: null,
      } });
    } catch (error) {
      const permanent = ['CONFIG', 'PROTOCOL', 'UNAUTHORIZED', 'SCHEMA', 'DUPLICATE', 'INVALID', 'CONFLICT'].includes(code);
      await this.prisma.recruitmentApplication.updateMany({ where: { id: job.id, leaseToken: token }, data: {
        syncStatus: permanent || job.syncAttempts >= 10 ? 'FAILED' : 'PENDING', syncError: code,
        nextSyncAt: new Date(Date.now() + Math.min(30 * 60_000, 60_000 * 2 ** Math.min(job.syncAttempts - 1, 5))),
        leaseToken: null, leaseUntil: null,
      } });
      const names = ['TimeoutError', 'AbortError', 'TypeError', 'SyntaxError'];
      const causes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'];
      const failure = error as { name?: string; cause?: { code?: string } };
      const name = names.includes(failure?.name || '') ? failure.name : 'Error';
      const cause = causes.includes(failure?.cause?.code || '') ? failure.cause!.code : 'UNKNOWN';
      this.logger.warn(`Recruitment sync code=${code}, attempt=${job.syncAttempts}, stage=${stage}, reason=${name}, cause=${cause}`);
    }
  }
}
