import { Body, Controller, ForbiddenException, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RecruitmentDto } from './recruitment.dto';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentSyncService } from './recruitment-sync.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { canWork, currentMembership, isLevelOne } from '../common/access';

@ApiTags('Recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly service: RecruitmentService) {}
  @Get('status') status() { return this.service.status(); }
  @Post('applications') @HttpCode(200)
  submit(@Body() dto: RecruitmentDto, @Req() request: Request) {
    return this.service.submit(dto, request.ip || request.socket.remoteAddress || 'unknown');
  }
  private authorize(request: Request) {
    const membership = currentMembership((request as any).user);
    if (!canWork(membership) || !isLevelOne(membership?.role) || membership?.tenure?.isFrozen || membership?.tenure?.isArchived) {
      throw new ForbiddenException('Chỉ Lv1 đang hoạt động được quản lý hồ sơ tuyển.');
    }
  }
  @Get('applications') @UseGuards(JwtAuthGuard)
  list(@Req() request: Request) {
    this.authorize(request);
    return this.service.list();
  }
  @Post('applications/:id/retry-sync') @UseGuards(JwtAuthGuard)
  retry(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: Request) {
    this.authorize(request);
    return this.service.retrySync(id);
  }
}

@Module({ controllers: [RecruitmentController], providers: [RecruitmentService, RecruitmentSyncService] })
export class RecruitmentModule {}
