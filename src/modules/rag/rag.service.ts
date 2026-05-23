import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ENV } from 'src/common/config/env.config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { Pinecone } from '@pinecone-database/pinecone';
import { randomUUID } from 'crypto';

@Injectable()
export class RagService {
  async processPdf(filePath: string): Promise<any> {
    const loader = new PDFLoader(filePath);

    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.splitDocuments(docs);

    const cleanedDocs = splitDocs.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: {
        source: doc.metadata.source,
        pdfName: doc.metadata.pdf?.info?.Title || 'Unknown',
        page: doc.metadata.loc?.pageNumber || 1,
      },
    }));

    const embeddings = new OllamaEmbeddings({
      model: ENV.EMBEDDING_MODEL,
      baseUrl: ENV.EMBEDD_BASE_URL,
    });

    const vectors = (
      await Promise.all(
        cleanedDocs.map(async (doc) => {
          const values = await embeddings.embedQuery(doc.pageContent);

          if (!values || values.length === 0) {
            console.warn('Empty embedding for doc, skipping:', doc.metadata);
            return null;
          }

          return {
            id: randomUUID(),
            values,
            metadata: {
              text: doc.pageContent,
              ...doc.metadata,
            },
          };
        }),
      )
    ).filter((v): v is NonNullable<typeof v> => v !== null);

    if (vectors.length === 0) {
      throw new Error(
        'No valid vectors generated — check your embedding model.',
      );
    }

    const pinecone = new Pinecone({
      apiKey: ENV.PINECONE_API_KEY,
    });

    const pineconeIndex = pinecone.Index(ENV.PINECONE_INDEX_NAME);

    await pineconeIndex.upsert({ records: vectors });

    return {
      totalDocs: cleanedDocs.length,
      totalVectors: vectors.length,
    };
  }
}
