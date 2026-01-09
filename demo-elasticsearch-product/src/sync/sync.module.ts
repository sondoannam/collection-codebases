import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';

@Module({
  // SyncService cần PrismaModule và SearchModule
  imports: [PrismaModule, SearchModule],
  providers: [SyncService],
  // Export SyncService để ProductModule có thể sử dụng
  exports: [SyncService],
})
export class SyncModule {}