import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, map } from 'rxjs';
import { signOpiinaResponse } from '../domain/rewards/hmac';

@Injectable()
export class MmRewardVerifyResponseInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        const secret = (
          this.config.get<string>('MM_REWARD_HMAC_SECRET') ?? ''
        ).trim();
        if (!secret) return data;

        const res = context.switchToHttp().getResponse<{
          setHeader: (name: string, value: string) => void;
        }>();
        const rawJson = JSON.stringify(data);
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signed = signOpiinaResponse({
          timestamp,
          rawBody: rawJson,
          secret,
        });
        res.setHeader('X-Opiina-Timestamp', signed.timestamp);
        res.setHeader('X-Opiina-Signature', signed.signature);
        return data;
      }),
    );
  }
}
