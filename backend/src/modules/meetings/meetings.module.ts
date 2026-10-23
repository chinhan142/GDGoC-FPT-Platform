import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
