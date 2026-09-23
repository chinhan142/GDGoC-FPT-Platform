import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MembersService } from './members.service';
import { QueryMembersDto } from './dto/query-members.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ImportMembersDto } from './dto/import-members.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';

@ApiTags('Members')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD, Role.ADVISOR, Role.DEPARTMENT_LEAD)
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách thành viên có bộ lọc đa tầng & phân trang',
  })
  @ApiResponse({ status: 200, description: 'Danh sách thành viên' })
  getMembers(
    @Query() query: QueryMembersDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.membersService.getMembers(query, currentUser);
  }

  @Get('/organizers')
  @ApiOperation({
    summary: 'Lấy danh sách Organizers / Ban Điều Hành cho Landing Page (Public)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách organizers' })
  getOrganizers(@Query('featured') featured?: string) {
    return this.membersService.getOrganizers(featured === 'true');
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD)
  @Post()
  @ApiOperation({ summary: 'Thêm mới thành viên vào nhiệm kỳ (Chỉ LEAD)' })
  @ApiResponse({ status: 201, description: 'Thêm thành viên thành công' })
  createMember(@Body() dto: CreateMemberDto) {
    return this.membersService.createMember(dto);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD)
  @Post('/import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import thành viên từ file Excel (.xlsx / .csv) (Chỉ LEAD)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        tenureId: { type: 'string' },
        defaultRole: { type: 'string', enum: Object.values(Role) },
        departmentCode: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Kết quả import Excel' })
  importMembers(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportMembersDto,
  ) {
    return this.membersService.importMembers(file, dto);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD)
  @Put(':id')
  @ApiOperation({
    summary: 'BCN cập nhật thông tin vai trò, ban, chức danh (Chỉ LEAD)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  updateMember(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.updateMember(id, dto);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.LEAD)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete thành viên (chuyển sang ALUMNI) (Chỉ LEAD)',
  })
  @ApiResponse({ status: 204, description: 'Xóa thành công' })
  deleteMember(@Param('id') id: string) {
    return this.membersService.deleteMember(id);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id/profile')
  @ApiOperation({
    summary: 'Thành viên tự cập nhật thông tin cá nhân (bio, kỹ năng, mạng xã hội)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật hồ sơ thành công' })
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.membersService.updateProfile(id, dto, currentUser);
  }
}
