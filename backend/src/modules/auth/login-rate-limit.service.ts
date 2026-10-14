import { HttpException, Injectable } from '@nestjs/common';

type Window = { count: number; resetAt: number };

@Injectable()
export class LoginRateLimitService {
  private readonly windows = new Map<string, Window>();

  check(identifier: string, ip: string) {
    const account = identifier.trim().toLowerCase().slice(0, 254);
    this.consume(`ip:${ip}`, 20, 60_000, 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.');
    this.consume(`account:${account}`, 10, 15 * 60_000, 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.');
  }
  checkPasswordMutation(identifier: string, ip: string) {
    this.consume(`password:${identifier}:${ip}`, 10, 15 * 60_000);
    this.consume(`password-ip:${ip}`, 30, 15 * 60_000);
  }

  checkForgotPassword(identifier: string, ip: string) {
    const account = identifier.trim().toLowerCase().slice(0, 254);

    // 1. Anti-spam cooldown: 1 request every 60 seconds per account
    this.consumeCooldown(`forgot:cooldown:${account}`, 60_000);

    // 2. Account rate limit: max 3 requests per 15 minutes
    this.consume(
      `forgot:account:${account}`,
      3,
      15 * 60_000,
      'Bạn đã yêu cầu đặt lại mật khẩu quá 3 lần trong 15 phút. Vui lòng chờ 15 phút trước khi thử lại.',
    );

    // 3. IP protection: max 10 requests per 15 minutes
    this.consume(
      `forgot:ip:${ip}`,
      10,
      15 * 60_000,
      'Quá nhiều yêu cầu từ địa chỉ IP của bạn. Vui lòng thử lại sau 15 phút.',
    );
  }

  private consumeCooldown(key: string, duration: number) {
    const now = Date.now();
    const previous = this.windows.get(key);
    if (previous && previous.resetAt > now) {
      const waitSeconds = Math.ceil((previous.resetAt - now) / 1000);
      throw new HttpException(
        `Vui lòng chờ ${waitSeconds} giây trước khi yêu cầu gửi lại email mới.`,
        429,
      );
    }
    this.windows.set(key, { count: 1, resetAt: now + duration });
  }

  private consume(
    key: string,
    limit: number,
    duration: number,
    errorMessage = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  ) {
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
    const window =
      previous && previous.resetAt > now
        ? previous
        : { count: 0, resetAt: now + duration };
    if (window.count >= limit) {
      throw new HttpException(errorMessage, 429);
    }
    window.count++;
    this.windows.set(key, window);
  }
}
