import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        errorCode = exception.name || 'HTTP_ERROR';
      } else if (typeof res === 'object' && res !== null) {
        const errorObj = res as Record<string, any>;
        message = Array.isArray(errorObj.message)
          ? errorObj.message.join(', ')
          : errorObj.message || exception.message;
        errorCode = errorObj.error || exception.name || 'HTTP_ERROR';
      }
    }

    if (status >= 500) {
      if (exception instanceof Error) this.logger.error(exception.message, exception.stack);
      message = 'Internal server error';
      errorCode = 'INTERNAL_SERVER_ERROR';
    }

    response.status(status).json({
      error: errorCode,
      message,
    });
  }
}
