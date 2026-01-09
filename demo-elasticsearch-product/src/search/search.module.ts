import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule], // Phải import để inject ConfigService
  providers: [SearchService],
  exports: [SearchService], // Export để các module khác dùng được
})
export class SearchModule {}