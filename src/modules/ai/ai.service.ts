import { ChatOpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ENV } from 'src/common/config/env.config';

@Injectable()
export class AiService {
  private model = new ChatOpenAI({
    model: ENV.MODEL,
    temperature: 0.7,
    apiKey: ENV.APIKEY,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
    },
  });

  async ask(question: string): Promise<string> {
    const response = await this.model.invoke(question);

    if (typeof response.content === 'string') {
      return response.content;
    }

    return JSON.stringify(response.content);
  }
}
