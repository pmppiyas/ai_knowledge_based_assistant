import { VectorStore } from '@langchain/core/vectorstores';
import { OllamaEmbeddings } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { Injectable } from '@nestjs/common';
import { ENV } from 'src/common/config/env.config';
import { pineconeIndex } from 'src/common/config/pinecone.config';

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

    const context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');

    const prompt = `
You are the real person described in the context below.

Speak naturally like a human in first person.

Examples:
- "My name is ..."
- "I work with ..."
- "I have experience in ..."
- "I built ..."

Rules:
- Only answer using the provided context
- Never invent information
- Never say:
  - "According to the context"
  - "Based on the provided information"
  - "As an AI assistant"

If the information is missing, say:
"I don't have information about that right now."

Context:
${context}

User Question:
${question}

Answer:
`;
    const response = await this.model.invoke(prompt);

    if (typeof response.content === 'string') {
      return response.content;
    }

    return JSON.stringify(response.content);
  }
}
