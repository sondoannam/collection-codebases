// src/worker/worker.module.ts

import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { PrismaModule } from '../prisma/prisma.module'; // <--- IMPORT THÊM
import { SearchModule } from '../search/search.module'; // <--- IMPORT THÊM

@Module({
  imports: [PrismaModule, SearchModule], // <--- KHAI BÁO Ở ĐÂY
  providers: [WorkerService],
})
export class WorkerModule {}