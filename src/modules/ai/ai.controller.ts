import { Controller, Get, Query } from '@nestjs/common';
import { AiService } from 'src/modules/ai/ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('ask')
  async ask(@Query('question') question: string) {
    if (!question || !question.trim()) {
      return {
        answer: "Hello! I'm Prince Mahmud Piyas. How can I help you today?",
        sources: [],
      };
    }

    try {
      const result = await this.aiService.ask(question);
      return {
        answer: result.answer,
        sources: result.sources,
      };
    } catch (err: any) {
      console.error('[AI Ask Controller Error]:', err?.message || err);
      return {
        answer:
          "Hi, I'm MD Prince Mahmud Piyas, a Junior Full Stack Developer and AI enthusiast based in Dhaka, Bangladesh. I currently work at NextLab, specializing in React, Next.js, TypeScript, Node.js, NestJS, and PostgreSQL. Feel free to ask about my projects, stack, or experience!",
        sources: [],
      };
    }
  }
}
