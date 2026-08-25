import { Module } from '@nestjs/common';
import { DriveService } from './drive.service';
import { DriveController } from './drive.controller';

@Module({
  controllers: [DriveController],
  providers: [DriveService],
})
export class DriveModule {}
