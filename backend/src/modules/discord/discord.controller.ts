import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Discord Automation')
@Controller('discord')
export class DiscordController {
  constructor(private readonly discordService: DiscordService) {}

  @Get('status')
  @ApiOperation({ summary: 'Kiểm tra trạng thái kết nối Discord Bot' })
  getStatus() {
    return {
      isReady: this.discordService.getIsReady(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('register-commands')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Đăng ký lại Slash Commands (/tasks, /profile) với Discord API',
  })
  async registerCommands() {
    await this.discordService.registerSlashCommands();
    return { message: 'Registered Discord Slash Commands successfully' };
  }
}
