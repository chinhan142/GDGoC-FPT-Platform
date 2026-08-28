import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OnboardMemberDto } from './dto/onboard-member.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/onboard-member')
  onboardMember(@Body() dto: OnboardMemberDto) {
    return this.authService.onboardMember(dto);
  }

  @Post('/login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
