import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';

@Module({
  controllers: [GamificationController],
  providers: [GamificationService],
})
export class GamificationModule {}
