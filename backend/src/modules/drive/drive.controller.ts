import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DriveService } from './drive.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { QueryAssetsDto } from './dto/query-assets.dto';
import { CreateEventFolderDto } from './dto/create-event-folder';
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

@ApiTags('Drive & Assets Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  @Get('assets')
  @ApiOperation({
    summary:
      'Lấy danh sách tài nguyên Google Drive (Tự động lọc theo phân quyền 4 cấp độ)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách tài nguyên thành công.' })
  findAllAssets(
    @GetUser() user: any,
    @Query() query: QueryAssetsDto,
  ) {
    return this.driveService.findAll(user, query);
  }

  @Get('assets/:id')
  @ApiOperation({ summary: 'Xem chi tiết một tài nguyên Drive' })
  findOneAsset(@Param('id') id: string) {
    return this.driveService.findOne(id);
  }

  @Post('assets')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({ summary: 'Đăng ký tài nguyên Google Drive mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký tài nguyên thành công.' })
  createAsset(
    @GetUser('id') userId: string,
    @Body() dto: CreateAssetDto,
  ) {
    return this.driveService.create(userId, dto);
  }

  @Put('assets/:id')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({ summary: 'Cập nhật thông tin tài nguyên Drive' })
  updateAssetPut(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.driveService.update(user, id, dto);
  }

  @Patch('assets/:id')
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({ summary: 'Cập nhật một phần tài nguyên Drive' })
  updateAssetPatch(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.driveService.update(user, id, dto);
  }

  @Delete('assets/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.LEAD, Role.DEPARTMENT_LEAD)
  @ApiOperation({ summary: 'Xóa tài nguyên Drive' })
  removeAsset(
    @GetUser() user: any,
    @Param('id') id: string,
  ) {
    return this.driveService.remove(user, id);
  }

  @Roles(Role.DEPARTMENT_LEAD, Role.LEAD)
  @Post('drive/create-folder')
  @ApiOperation({ summary: 'Tạo thư mục Google Drive cho sự kiện' })
  createEventFolder(@Body() dto: CreateEventFolderDto) {
    return this.driveService.createEventFolder(dto);
  }
}
