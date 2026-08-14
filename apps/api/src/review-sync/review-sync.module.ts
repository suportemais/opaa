import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReviewSyncService } from './review-sync.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ReviewSyncService],
  exports: [ReviewSyncService],
})
export class ReviewSyncModule {}
