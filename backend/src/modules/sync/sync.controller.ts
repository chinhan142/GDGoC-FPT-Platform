import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { SyncService, SyncStatusResponse } from './sync.service';

@Controller('api/sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  async getStatus(@GetUser() user: any): Promise<SyncStatusResponse> {
    return this.syncService.getStatus(user);
  }
}
