import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './modules/ai/ai.module';
import { ConfigModule } from '@nestjs/config';
import { RagModule } from './modules/rag/rag.module';

@Module({
  imports: [ConfigModule.forRoot(), AiModule, RagModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
