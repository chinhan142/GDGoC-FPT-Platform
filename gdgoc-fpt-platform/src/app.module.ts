import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { DiscordModule } from './modules/discord/discord.module';
import { DriveModule } from './modules/drive/drive.module';
import { EventsModule } from './modules/events/events.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { TenuresModule } from './modules/tenures/tenures.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TenuresModule,
    DepartmentsModule,
    TasksModule,
    EventsModule,
    DriveModule,
    DiscordModule,
    GamificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
