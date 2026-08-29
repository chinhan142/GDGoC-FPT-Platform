import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DriveService } from './drive.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Drive')
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DEPARTMENT_LEAD, Role.LEAD)
  @Post('/create-folder')
  createEventFolder(@Body() dto: CreateEventDto) {
    return this.driveService.createEventFolder(dto);
  }
}
