import { Module } from '@nestjs/common';
import { GemsService } from './gems.service';
import { GemsController } from './gems.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GemsController],
  providers: [GemsService],
  exports: [GemsService],
})
export class GemsModule {}
