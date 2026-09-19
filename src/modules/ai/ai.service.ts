import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { pineconeIndex } from 'src/common/config/pinecone.config';
import { generatePrompt } from 'src/common/config/prompt/generatePromt';
import { ENV } from 'src/common/config/env.config';

export interface AiSourceItem {
  type: 'pdf' | 'github' | 'knowledge_base';
  title: string;
  repo?: string;
  file?: string;
  snippet: string;
}

export interface AiAskResult {
  answer: string;
  sources: AiSourceItem[];
}

@Injectable()
export class AiService {
  private model = new ChatOpenAI({
    model: ENV.MODEL,
    temperature: 0.2,
    apiKey: ENV.APIKEY,
    configuration: {
      baseURL: ENV.BASE_URL,
    },
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

    if (!response.ok) {
      throw new Error(
        `Embedding API Error: ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json();

    const embedding = json?.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error(`Invalid embedding response: ${JSON.stringify(json)}`);
    }

    return embedding;
  }

  async ask(question: string): Promise<AiAskResult> {
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

    const relevantDocs = await vectorStore.similaritySearch(question, 6);

    console.log(
      `[AI Query] Question: "${question}" -> Retrieved ${relevantDocs.length} chunks`,
    );

    const sources: AiSourceItem[] = relevantDocs.map((doc: any) => {
      const type = doc.metadata?.type;
      if (type === 'pdf') {
        return {
          type: 'pdf',
          title: 'Resume / CV of Prince Mahmud Piyas',
          snippet: doc.pageContent ? doc.pageContent.slice(0, 180) : '',
        };
      }
      if (type === 'github') {
        const repo = doc.metadata?.repo || 'Unknown Repo';
        const file = doc.metadata?.file || 'File';
        return {
          type: 'github',
          title: `${repo} (${file})`,
          repo,
          file,
          snippet: doc.pageContent ? doc.pageContent.slice(0, 180) : '',
        };
      }
      return {
        type: 'knowledge_base',
        title: 'Knowledge Base',
        snippet: doc.pageContent ? doc.pageContent.slice(0, 180) : '',
      };
    });

    const formatDocContext = (doc: any): string => {
      const type = doc.metadata?.type;
      if (type === 'pdf') {
        return `[Source: Resume / CV of Prince Mahmud Piyas]\n${doc.pageContent}`;
      }
      if (type === 'github') {
        const repo = doc.metadata?.repo || 'Unknown Repo';
        const file = doc.metadata?.file || 'File';
        return `[Source: GitHub Repository: ${repo} | File: ${file}]\n${doc.pageContent}`;
      }
      return `[Source: Knowledge Base]\n${doc.pageContent}`;
    };

    const context =
      relevantDocs.length > 0
        ? relevantDocs.map(formatDocContext).join('\n\n---\n\n')
        : 'No relevant documents found in knowledge base.';

    const prompt = generatePrompt(context, question);

    const response = await this.model.invoke(prompt);

    const answer =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    return {
      answer,
      sources,
    };
  }
}
