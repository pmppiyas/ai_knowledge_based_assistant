import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { GithubController } from './github/github.controller';
import { GithubController } from './github.controller';

@Module({
  controllers: [RagController, GithubController],
  providers: [RagService],
})
export class RagModule {}
