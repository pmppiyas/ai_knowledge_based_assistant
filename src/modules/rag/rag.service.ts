import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ENV } from 'src/common/config/env.config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { Pinecone } from '@pinecone-database/pinecone';
import { generateChunkId } from 'src/common/utils/generateChunkId';

@Injectable()
export class RagService {
  // private async storeDocuments(cleanedDocs: any[]) {
  //   const embeddings = new OllamaEmbeddings({
  //     model: ENV.EMBEDDING_MODEL,
  //     baseUrl: ENV.EMBEDD_BASE_URL,
  //   });

  //   const vectors = (
  //     await Promise.all(
  //       cleanedDocs.map(async (doc) => {
  //         const values = await embeddings.embedQuery(doc.pageContent);

  //         if (!values || values.length === 0) {
  //           return null;
  //         }

  //         return {
  //           id: randomUUID(),
  //           values,
  //           metadata: {
  //             text: doc.pageContent,
  //             ...doc.metadata,
  //           },
  //         };
  //       }),
  //     )
  //   ).filter((v): v is NonNullable<typeof v> => v !== null);

  //   const pinecone = new Pinecone({
  //     apiKey: ENV.PINECONE_API_KEY,
  //   });

  //   const pineconeIndex = pinecone.Index(ENV.PINECONE_INDEX_NAME);

  //   await pineconeIndex.upsert({
  //     records: vectors,
  //   });

  //   return vectors.length;
  // }

  private async storeDocuments(cleanedDocs: any[]) {
    const embeddings = new OllamaEmbeddings({
      model: ENV.EMBEDDING_MODEL,
      baseUrl: ENV.EMBEDD_BASE_URL,
    });

    const vectors = (
      await Promise.all(
        cleanedDocs.map(async (doc) => {
          const values = await embeddings.embedQuery(doc.pageContent);

          if (!values || values.length === 0) return null;

          return {
            id: generateChunkId(doc),
            values,
            metadata: {
              text: doc.pageContent,
              ...doc.metadata,
            },
          };
        }),
      )
    ).filter((v): v is NonNullable<typeof v> => v !== null);

    const pinecone = new Pinecone({
      apiKey: ENV.PINECONE_API_KEY,
    });

    const index = pinecone.Index(ENV.PINECONE_INDEX_NAME);

    await index.upsert({
      records: vectors,
    });

    return vectors.length;
  }

  async processPdf(filePath: string) {
    const loader = new PDFLoader(filePath);

    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.splitDocuments(docs);

    const cleanedDocs = splitDocs.map((doc, index) => ({
      pageContent: doc.pageContent,
      metadata: {
        type: 'pdf',
        source: doc.metadata.source,
        file: filePath,
        chunkIndex: index,
      },
    }));

    const total = await this.storeDocuments(cleanedDocs);

    return {
      success: true,
      total,
    };
  }

  async syncGithubRepo(owner: string, repo: string) {
    const filesToFetch = ['README.md', 'package.json'];

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const allChunks: any[] = [];

    for (const fileName of filesToFetch) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
          {
            headers: {
              Authorization: `token ${ENV.GITHUB_TOKEN}`,
              Accept: 'application/vnd.github+json',
            },
          },
        );

        if (!response.ok) continue;

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        const fileDoc = {
          pageContent: content,
          metadata: {
            type: 'github',
            repo: `${owner}/${repo}`,
            file: fileName,
          },
        };

        const splitDocs = await splitter.splitDocuments([fileDoc]);

        const fileChunks = splitDocs.map((chunk, index) => ({
          pageContent: chunk.pageContent,
          metadata: {
            type: 'github',
            repo: `${owner}/${repo}`,
            file: fileName,
            chunkIndex: index,
          },
        }));

        allChunks.push(...fileChunks);
      } catch (err) {
        console.warn(`Failed to fetch ${fileName}:`, err);
      }
    }

    const total = await this.storeDocuments(allChunks);

    console.log(`Synced ${owner}/${repo} → ${total} vectors`);

    return {
      success: true,
      total,
    };
  }
}
