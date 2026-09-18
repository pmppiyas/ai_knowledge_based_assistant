import { Controller, Get, Query } from '@nestjs/common';
import { AiService } from 'src/modules/ai/ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('ask')
  async ask(@Query('question') question: string) {
    const result = await this.aiService.ask(question);

    return {
      answer: result.answer,
      sources: result.sources,
    };
  }
}
