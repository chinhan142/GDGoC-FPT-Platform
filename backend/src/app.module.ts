import { RealtimeModule } from './modules/realtime/realtime.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DriveModule } from './modules/drive/drive.module';
import { EventsModule } from './modules/events/events.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TenuresModule } from './modules/tenures/tenures.module';
import { MembersModule } from './modules/members/members.module';
import { GemsModule } from './modules/gems/gems.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CmsModule } from './modules/cms/cms.module';
import { MailModule } from './modules/mail/mail.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RealtimeModule,
    MailModule,
    RecruitmentModule,
    AuthModule,
    MembersModule,
    TenuresModule,
    TasksModule,
    EventsModule,
    DriveModule,
    GemsModule,
    InventoryModule,
    NotificationsModule,
    CmsModule,
  ],
})
export class AppModule {}
