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

  @Get('sync-repo')
  async syncRepoGet(
    @Query('owner') owner?: string,
    @Query('repo') repo?: string,
  ) {
    const targetOwner = owner || 'pmppiyas';
    if (!repo) {
      return {
        success: false,
        message: 'repo query parameter is required (e.g. ?repo=web)',
      };
    }
    const result = await this.ragService.syncGithubRepo(
      targetOwner,
      repo,
      true,
    );
    return {
      success: true,
      message: `GitHub repo ${targetOwner}/${repo} synced successfully`,
      data: result,
    };
  }

  @Post('sync-repo')
  async syncRepoPost(
    @Query('owner') owner?: string,
    @Query('repo') repo?: string,
  ) {
    return this.syncRepoGet(owner, repo);
  }

  @Get('reset-and-sync')
  async resetAndSyncGet(@Query('owner') owner?: string) {
    return this.resetAndSync(owner);
  }

  @Post('reset-and-sync')
  async resetAndSync(@Query('owner') owner?: string) {
    const targetOwner = owner || 'pmppiyas';
    console.log(
      `[Reset & Sync] Starting full reset and clean sync for ${targetOwner}...`,
    );

    await this.ragService.clearIndex();

    const pdfResult = await this.ragService.reindexLatestPdf();

    const githubResult = await this.ragService.syncAllTargetedRepos(
      targetOwner,
      true,
    );

    return {
      success: true,
      message: 'Knowledge base reset and re-indexed cleanly',
      pdf: pdfResult,
      github: githubResult,
    };
  }
}
