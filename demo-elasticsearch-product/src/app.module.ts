import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SearchModule } from './search/search.module';
import { ProductModule } from './product/product.module';
import { WorkerModule } from './worker/worker.module';
import { ConfigModule } from '@nestjs/config';
// import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule, SearchModule, ProductModule, SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
