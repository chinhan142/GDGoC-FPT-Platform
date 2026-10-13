import { HttpException, Injectable } from '@nestjs/common';

type Window = { count: number; resetAt: number };

@Injectable()
export class LoginRateLimitService {
  private readonly windows = new Map<string, Window>();

  check(identifier: string, ip: string) {
    const account = identifier.trim().toLowerCase().slice(0, 254);
    this.consume(`ip:${ip}`, 20, 60_000);
    this.consume(`account:${account}`, 10, 15 * 60_000);
  }

  private consume(key: string, limit: number, duration: number) {
    const now = Date.now();
    if (this.windows.size > 10_000) {
      for (const [storedKey, value] of this.windows) {
        if (value.resetAt <= now) this.windows.delete(storedKey);
      }
    }
    if (this.windows.size >= 20_000 && !this.windows.has(key)) {
      this.windows.delete(this.windows.keys().next().value!);
    }
    const previous = this.windows.get(key);
    const window = previous && previous.resetAt > now
      ? previous
      : { count: 0, resetAt: now + duration };
    if (window.count >= limit) {
      throw new HttpException('Quá nhiều lần đăng nhập. Vui lòng thử lại sau.', 429);
    }
    window.count++;
    this.windows.set(key, window);
  }
}
