import { Body, Controller, Post, Req } from '@nestjs/common';
import { verifyGitHubSignature } from 'src/common/utils/verifyGithubSignature';
import { RagService } from 'src/modules/rag/rag.service';

@Controller('github')
export class GithubController {
  constructor(private readonly ragService: RagService) {}

  @Post('webhook')
  async githubWebhook(@Req() req: any, @Body() body: any) {
    const event = req.headers['x-github-event'];

    if (event !== 'push') {
      return {
        success: true,
        message: 'Ignored event',
      };
    }

    const isValid = verifyGitHubSignature(
      req,
      process.env.GITHUB_WEBHOOK_SECRET as string,
    );

    if (!isValid) {
      console.error('Invalid GitHub webhook signature');
      return {
        success: false,
        message: 'Invalid signature',
      };
    }

    console.log('Webhook received');

    const repo = body.repository.name;
    const owner = body.repository.owner.login;

    if (!repo || !owner) {
      return { success: false };
    }

    await this.ragService.syncGithubRepo(owner, repo);

    return {
      success: true,
    };
  }
}
