import { Module } from '@nestjs/common';
import { WhistleblowerController } from './whistleblower.controller';
import { WhistleblowerService } from './whistleblower.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WhistleblowerController],
  providers: [WhistleblowerService],
  exports: [WhistleblowerService],
})
export class WhistleblowerModule {}
