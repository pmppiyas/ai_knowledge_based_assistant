import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { ENV } from 'src/common/config/env.config';
import { pineconeIndex } from 'src/common/config/pinecone.config';
import { generatePrompt } from 'src/common/config/prompt/generatePromt';

@Injectable()
export class AiService {
  private model = new ChatOpenAI({
    model: ENV.MODEL,
    apiKey: ENV.APIKEY,
    configuration: {
      baseURL: ENV.BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'My App',
      },
    },
    temperature: 0.5,
  });

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${ENV.EMBEDD_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ENV.APIKEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'My App',
      },
      body: JSON.stringify({
        model: ENV.EMBEDDING_MODEL,
        input: text,
      }),
    });

    const json = await response.json();
    return json?.data?.[0]?.embedding ?? null;
  }

  async ask(question: string): Promise<string> {
    const embeddings = {
      embedDocuments: async (texts: string[]) => {
        return Promise.all(texts.map((text) => this.getEmbedding(text)));
      },

      embedQuery: async (text: string) => {
        return this.getEmbedding(text);
      },
    };

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
    });

    const retriever = vectorStore.asRetriever({
      k: 3,
    });

    const relevantDocs = await retriever.invoke(question);

    const context = relevantDocs
      .map((doc) => doc.pageContent.slice(0, 800))
      .join('\n\n');

    const prompt = generatePrompt(context, question);

    const response = await this.model.invoke(prompt);

    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }
}
