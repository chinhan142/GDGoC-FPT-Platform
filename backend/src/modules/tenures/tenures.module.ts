import { Module } from '@nestjs/common';
import { TenuresService } from './tenures.service';
import { TenuresController } from './tenures.controller';

@Module({
  controllers: [TenuresController],
  providers: [TenuresService],
})
export class TenuresModule {}
