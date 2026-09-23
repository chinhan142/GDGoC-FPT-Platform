import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { TenuresService } from './tenures.service';
import { UpdateTenureConfigDto } from './dto/update-tenure-config.dto';
import { TransitionTenureDto } from './dto/transition-tenure.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Generation / Tenure Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('config/generation')
export class TenuresController {
  constructor(private readonly tenuresService: TenuresService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lấy thông tin cấu hình nhiệm kỳ hiện tại & danh sách lưu trữ kỳ cũ (Kèm snapshot số liệu)',
  })
  @ApiResponse({ status: 200, description: 'Lấy cấu hình thành công.' })
  getGenerationConfig() {
    return this.tenuresService.getGenerationConfig();
  }

  @Put()
  @Roles(Role.LEAD)
  @ApiOperation({
    summary:
      'Cập nhật cấu hình nhiệm kỳ hiện tại (Đóng băng, RSVP, nộp bài, Chapter Lead)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật cấu hình thành công.' })
  updateGenerationConfig(@Body() dto: UpdateTenureConfigDto) {
    return this.tenuresService.updateGenerationConfig(dto);
  }

  @Post('transition')
  @Roles(Role.LEAD)
  @ApiOperation({
    summary:
      'Chuyển giao nhiệm kỳ mới (Archive kỳ cũ, khởi tạo kỳ mới, sao chép Core Team, broadcast)',
  })
  @ApiResponse({ status: 200, description: 'Chuyển giao nhiệm kỳ thành công.' })
  transition(
    @GetUser('id') adminId: string,
    @Body() dto: TransitionTenureDto,
  ) {
    return this.tenuresService.transition(dto, adminId);
  }
}
