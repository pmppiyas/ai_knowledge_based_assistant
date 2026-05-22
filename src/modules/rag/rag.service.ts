import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

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
      content: doc.pageContent,
      source: doc.metadata.source,
      pdf: {
        name: doc.metadata.pdf.info.Title || 'Unknown',
        page: doc.metadata.loc?.pageNumber,
      },
    }));

    return {
      success: true,
      message: 'PDF processed successfully',
      docs: cleanedDocs,
    };
  }
}
