import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
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
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = exception.name || 'INTERNAL_ERROR';
    }

    response.status(status).json({
      error: errorCode,
      message,
    });
  }
}
