import { Body, Controller, Post, Req } from '@nestjs/common';
import { verifyGitHubSignature } from 'src/common/utils/verifyGithubSignature';
import { RagService } from 'src/modules/rag/rag.service';

@Controller('github')
export class GithubController {
  constructor(private readonly ragService: RagService) {}

  @Post('webhook')
  async githubWebhook(@Req() req: any, @Body() body: any) {
    const event = req.headers['x-github-event'];

    // GitHub sends a 'ping' event when creating/testing the webhook
    if (event === 'ping') {
      console.log('GitHub Ping webhook received successfully');
      return {
        success: true,
        message: 'Ping event acknowledged',
      };
    }

    if (event !== 'push') {
      return {
        success: true,
        message: `Ignored event: ${event}`,
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

    const repo = body?.repository?.name;
    const owner = body?.repository?.owner?.login;

    if (!repo || !owner) {
      return { success: false, message: 'Missing repo or owner in payload' };
    }

    console.log(`Valid GitHub Push webhook received for ${owner}/${repo}`);

    // Directly sync the pushed repo in the background with forceUpdate=true so new commits are immediately indexed
    (async () => {
      console.log(`[GitHub Webhook] Starting background sync for pushed repo: ${owner}/${repo}...`);
      const repoResult = await this.ragService.syncGithubRepo(owner, repo, true);
      console.log(`[GitHub Webhook] Finished sync for ${owner}/${repo}:`, repoResult);
    })().catch((err) => {
      console.error(`[Background Sync Error for ${owner}/${repo}]:`, err);
    });

    return {
      success: true,
      message: `Sync started in background for ${owner}/${repo}`,
    };
  }
}
