import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ENV } from 'src/common/config/env.config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';

@Injectable()
export class RagService {
  async processPdf(filePath: string): Promise<any> {
    const loader = new PDFLoader(filePath);

    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const slittedDocs = await splitter.splitDocuments(docs);

    const cleanedDocs = slittedDocs.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: {
        source: doc.metadata.source,
        pdf: {
          name: doc.metadata.pdf.info.Title || 'Unknown',
          page: doc.metadata.loc?.pageNumber,
        },
      },
    }));

    const embeddings = new OllamaEmbeddings({
      model: 'nomic-embed-text:latest',
      baseUrl: 'http://localhost:11434',
    });

    const vector = await embeddings.embedQuery('Hello world');

    const pinecone = new Pinecone({
      apiKey: ENV.PINECONE_API_KEY,
    });

    const pineconeIndex = pinecone.Index(ENV.PINECONE_INDEX_NAME);

    await PineconeStore.fromDocuments(cleanedDocs, embeddings, {
      pineconeIndex,
    });

    return {
      success: true,
      message: 'PDF processed successfully',
      docs: cleanedDocs,
    };
  }
}
