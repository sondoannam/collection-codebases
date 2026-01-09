import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SyncModule } from '../sync/sync.module'; // <--- Import SyncModule
import { SearchModule } from 'src/search/search.module';
import { AttributeDictionaryService } from './attribute-dictionary.service';
import { QueryParserService } from './query-parser.service';
import { DemoSearchService } from './demo-search.service';

@Module({
  // ProductModule cần các service từ PrismaModule và SyncModule
  imports: [PrismaModule, SyncModule, SearchModule], 
  controllers: [ProductController],
  providers: [
    ProductService, 
    AttributeDictionaryService, 
    QueryParserService,
    DemoSearchService
  ],
})
export class ProductModule {}