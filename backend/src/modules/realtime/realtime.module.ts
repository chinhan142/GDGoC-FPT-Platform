import {
  Controller,
  Global,
  Injectable,
  MessageEvent,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { filter, interval, map, merge, Observable, Subject } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private listener?: PoolClient;
  private retry?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private changes = new Subject<{ userIds: string[]; resources: string[] }>();
  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow('DATABASE_URL'),
      max: 1,
      connectionTimeoutMillis: 5000,
    });
  }
  async onModuleInit() {
    await this.connect();
  }
  private async connect() {
    try {
      const client = await this.pool.connect();
      this.listener = client;
      client.on('notification', (event) => {
        try {
          const payload = JSON.parse(event.payload || '{}');
          if (
            Array.isArray(payload.userIds) &&
            Array.isArray(payload.resources)
          )
            this.changes.next(payload);
        } catch {}
      });
      client.on('error', () => {
        client.release(true);
        this.listener = undefined;
        if (!this.stopped)
          this.retry = setTimeout(() => void this.connect(), 5000);
      });
      await client.query('LISTEN gdgoc_updates');
      this.changes.next({ userIds: [], resources: ['tasks', 'notifications'] });
    } catch {
      if (!this.stopped)
        this.retry = setTimeout(() => void this.connect(), 5000);
    }
  }
  stream(userId: string): Observable<MessageEvent> {
    return merge(
      this.changes.pipe(
        filter((e) => !e.userIds.length || e.userIds.includes(userId)),
        map((e) => ({ type: 'refresh', data: { resources: e.resources } })),
      ),
      interval(25000).pipe(map(() => ({ type: 'heartbeat', data: {} }))),
    );
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.listener?.release();
    await this.pool.end();
    this.changes.complete();
  }
}
@Controller('live')
@UseGuards(JwtAuthGuard)
class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}
  @Sse('stream') stream(@GetUser('id') userId: string) {
    return this.realtime.stream(userId);
  }
}
@Global()
@Module({
  providers: [RealtimeService],
  controllers: [RealtimeController],
  exports: [RealtimeService],
})
export class RealtimeModule {}
