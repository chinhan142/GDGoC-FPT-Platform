import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { OnboardMemberDto } from './dto/onboard-member.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng email & password, cấp HttpOnly Cookie session_token' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, res);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  @ApiOperation({ summary: 'Lấy thông tin profile & currentTenure của user hiện tại' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin session' })
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất, xóa HttpOnly Cookie session_token' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @ApiCookieAuth('session_token')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu người dùng' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.authService.changePassword(dto, userId);
  }

  @Post('/onboard-member')
  @ApiOperation({ summary: 'Webhook tự động tạo tài khoản khi điền Google Form tuyển dụng' })
  onboardMember(
    @Body() dto: OnboardMemberDto,
    @Headers('x-webhook-secret') webhookSecret: string,
  ) {
    return this.authService.onboardMember(dto, webhookSecret);
  }
}
