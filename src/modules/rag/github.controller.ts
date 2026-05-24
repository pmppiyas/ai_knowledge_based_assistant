import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from 'src/modules/rag/rag.service';

@Controller('github')
export class GithubController {
  constructor(private readonly ragService: RagService) {}

  @Post('webhook')
  async githubWebhook(@Body() body: any) {
    const repo = body.repository.name;
    const owner = body.repository.owner.login;

    await this.ragService.syncGithubRepo(owner, repo);

    return {
      success: true,
      message: `GitHub repository synced successfully`,
    };
  }
}
