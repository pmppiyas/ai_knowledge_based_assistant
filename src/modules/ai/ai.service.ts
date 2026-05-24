import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { PineconeStore } from '@langchain/pinecone';
import { Injectable } from '@nestjs/common';
import { ENV } from 'src/common/config/env.config';
import { pineconeIndex } from 'src/common/config/pinecone.config';
import { generatePrompt } from 'src/common/config/prompt/generatePromt';

@Injectable()
export class AiService {
  private model = new ChatOllama({
    model: ENV.MODEL,
    baseUrl: ENV.BASE_URL,
    temperature: 0.5,
  });

  async ask(question: string): Promise<string> {
    const embeddings = new OllamaEmbeddings({
      model: ENV.EMBEDDING_MODEL,
      baseUrl: ENV.EMBEDD_BASE_URL,
    });

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

    if (typeof response.content === 'string') {
      return response.content;
    }

    return JSON.stringify(response.content);
  }
}
