import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecruitmentDto } from './recruitment.dto';

@Injectable()
export class RecruitmentService {
  private readonly windows = new Map<string, { count: number; expires: number }>();
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  status() {
    const cycleLabel = this.config.get<string>('RECRUITMENT_CYCLE')?.trim() || '';
    return { enabled: this.config.get<string>('RECRUITMENT_OPEN') === 'true' && !!cycleLabel, cycleLabel };
  }

  list() {
    return this.prisma.recruitmentApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async retrySync(id: string) {
    const result = await this.prisma.recruitmentApplication.updateMany({
      where: { id, syncStatus: 'FAILED' },
      data: { syncStatus: 'PENDING', syncAttempts: 0, syncError: null, nextSyncAt: new Date(), leaseToken: null, leaseUntil: null },
    });
    if (!result.count) throw new BadRequestException('Chỉ hồ sơ đồng bộ FAILED được gửi lại bằng thao tác này.');
    return { queued: true };
  }

  private rateLimit(ip: string) {
    const now = Date.now();
    for (const [key, window] of this.windows) if (window.expires <= now) this.windows.delete(key);
    if (this.windows.size >= 10_000 && !this.windows.has(ip)) throw new HttpException('Hệ thống đang bận. Vui lòng thử lại sau.', 429);
    const window = this.windows.get(ip) || { count: 0, expires: now + 10 * 60_000 };
    if (window.count >= 10) throw new HttpException('Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.', 429);
    window.count++;
    this.windows.set(ip, window);
  }

  async submit(dto: RecruitmentDto, ip: string) {
    this.rateLimit(ip);
    if (dto.website || !dto.consent || dto.nv2 === dto.nv1) throw new BadRequestException('Vui lòng kiểm tra nguyện vọng và xác nhận thông tin.');
    const isTech = ['AI', 'Cloud', 'Web Development', 'Research'].includes(dto.nv1);
    const nonTechOrCommunity = (dto.communitySkills ?? dto.nonTechSkills);
    if (!(isTech ? dto.techStack : nonTechOrCommunity)?.trim()) throw new BadRequestException('Vui lòng chia sẻ công nghệ hoặc kỹ năng phù hợp với NV1.');
    const { website, ...fields } = dto;
    const cycle = this.status().cycleLabel;
    const payload = {
      ...fields,
      email: dto.email.toLowerCase().trim(),
      studentId: dto.studentId.toUpperCase().trim(),
      cycle,
      techStack: isTech ? dto.techStack : '',
      nonTechSkills: isTech ? '' : (dto.nonTechSkills ?? dto.communitySkills ?? ''),
    };
    const payloadHash = createHash('sha256').update(JSON.stringify(payload, Object.keys(payload).sort())).digest('hex');
    try {
      const previous = await this.prisma.recruitmentApplication.findUnique({ where: { requestId: dto.requestId } });
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new ConflictException('Thông tin lần gửi lại đã thay đổi. Vui lòng thử gửi lại hồ sơ.');
        return { candidateId: previous.candidateId, cycleLabel: previous.cycle };
      }
      if (!this.status().enabled) throw new BadRequestException('Đợt tuyển hiện chưa mở nhận hồ sơ.');
      // This insert atomically persists the application and its pending sync job.
      const application = await this.prisma.recruitmentApplication.create({ data: {
        requestId: dto.requestId, cycle, email: payload.email, studentId: payload.studentId,
        payload: payload as Prisma.InputJsonObject, payloadHash,
      } });
      return { candidateId: application.candidateId, cycleLabel: cycle };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const previous = await this.prisma.recruitmentApplication.findUnique({ where: { requestId: dto.requestId } });
        if (previous?.payloadHash === payloadHash) return { candidateId: previous.candidateId, cycleLabel: previous.cycle };
        if (previous) throw new ConflictException('Thông tin lần gửi lại đã thay đổi.');
        throw new ConflictException('Email hoặc MSSV đã có hồ sơ trong đợt tuyển này. Vui lòng liên hệ CLB nếu cần chỉnh sửa.');
      }
      throw new ServiceUnavailableException('Chưa lưu được hồ sơ. Hãy giữ nguyên thông tin và thử gửi lại.');
    }
  }
}
