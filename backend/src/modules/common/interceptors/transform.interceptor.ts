import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data?: T;
  message?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is already null or undefined (e.g. 204 No Content), return data
        if (data === null || data === undefined) {
          return data;
        }

        // If data is already formatted with data & message, avoid double wrapping
        if (typeof data === 'object' && ('data' in data || 'message' in data)) {
          return {
            message: data.message || 'Success',
            ...data,
          };
        }

        return {
          data,
          message: 'Success',
        };
      }),
    );
  }
}
