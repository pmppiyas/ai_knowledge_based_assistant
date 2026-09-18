import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
      }),
    }),
  )
  async uploadPdf(@UploadedFile() file: any): Promise<any> {
    const result = await this.ragService.processPdf(file.path);
    return {
      success: true,
      message: 'PDF processed and stored successfully',
      data: result,
    };
  }

  @Delete('clear')
  async clearIndexDelete() {
    return this.ragService.clearIndex();
  }

  @Post('clear')
  async clearIndexPost() {
    return this.ragService.clearIndex();
  }

  @Post('reindex-pdf')
  async reindexPdf() {
    const result = await this.ragService.reindexLatestPdf();
    return {
      success: true,
      message: 'Latest uploaded PDF reindexed successfully',
      data: result,
    };
  }

  @Post('sync-github')
  async syncGithubPost(@Query('owner') owner?: string) {
    const targetOwner = owner || 'pmppiyas';
    const result = await this.ragService.syncAllTargetedRepos(targetOwner);
    return {
      success: true,
      message: `GitHub repos synced for ${targetOwner}`,
      data: result,
    };
  }

  @Get('sync-github')
  async syncGithubGet(@Query('owner') owner?: string) {
    const targetOwner = owner || 'pmppiyas';
    const result = await this.ragService.syncAllTargetedRepos(targetOwner);
    return {
      success: true,
      message: `GitHub repos synced for ${targetOwner}`,
      data: result,
    };
  }

  @Post('reset-and-sync')
  async resetAndSync(@Query('owner') owner?: string) {
    const targetOwner = owner || 'pmppiyas';
    console.log(`[Reset & Sync] Starting full reset and clean sync for ${targetOwner}...`);
    
    // 1. Clear old/polluted vectors
    await this.ragService.clearIndex();

    // 2. Re-index user's CV
    const pdfResult = await this.ragService.reindexLatestPdf();

    // 3. Sync GitHub repos with boilerplate filtering
    const githubResult = await this.ragService.syncAllTargetedRepos(targetOwner);

    return {
      success: true,
      message: 'Knowledge base reset and re-indexed cleanly',
      pdf: pdfResult,
      github: githubResult,
    };
  }
}
