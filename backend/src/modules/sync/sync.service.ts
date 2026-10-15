import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { currentMembership } from '../common/access';

export interface SyncStatusResponse {
  revisions: Record<string, string>;
  fingerprint: {
    userId: string;
    role: string;
    departmentId: string | null;
    status: string;
    tenureId: string | null;
  };
  serverTime: string;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(user: any): Promise<SyncStatusResponse> {
    const records = await this.prisma.syncRevision.findMany();
    const revisions: Record<string, string> = {
      tasks: '',
      events: '',
      gems: '',
      notifications: '',
      semesters: '',
      members: '',
    };

    for (const row of records) {
      revisions[row.resourceGroup] = row.revision;
    }

    const membership = currentMembership(user);
    const fingerprint = {
      userId: user?.id || '',
      role: membership?.role || user?.role || 'MEMBER',
      departmentId: membership?.departmentId || user?.banId || null,
      status: membership?.status || user?.status || 'ACTIVE',
      tenureId: membership?.tenureId || null,
    };

    return {
      revisions,
      fingerprint,
      serverTime: new Date().toISOString(),
    };
  }
}
