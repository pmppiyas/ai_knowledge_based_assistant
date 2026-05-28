import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ENV } from 'src/common/config/env.config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { pineconeIndex } from 'src/common/config/pinecone.config';
import { generateChunkId } from 'src/common/utils/generateChunkId';
import { getAllRepos } from 'src/common/utils/getAllRepos';

@Injectable()
export class RagService {
  private async storeDocuments(cleanedDocs: any[]) {
    const embeddings = new OllamaEmbeddings({
      model: ENV.EMBEDDING_MODEL,
      baseUrl: ENV.EMBEDD_BASE_URL,
    });

    const vectors = (
      await Promise.all(
        cleanedDocs.map(async (doc) => {
          const values = await embeddings.embedQuery(doc.pageContent);

          if (!values || values.length === 0) {
            return null;
          }

          return {
            id: doc.id,
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
      console.log('No new vectors to store.\n');
      return 0;
    }

    await pineconeIndex.upsert({
      records: vectors,
    });

    return vectors.length;
  }

  private async filterExistingChunks(
    chunks: Array<{
      id: string;
      pageContent: string;
      metadata: any;
    }>,
  ) {
    const ids = chunks.map((c) => c.id);

    const existing = await pineconeIndex.fetch({
      ids,
    });

    const existingIds = new Set(Object.keys(existing.records ?? {}));

    const newChunks = chunks.filter((c) => !existingIds.has(c.id));

    console.log(
      `Duplicate check → total: ${chunks.length}, already exists: ${existingIds.size}, new: ${newChunks.length}`,
    );

    return newChunks;
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
      id: generateChunkId('pdf', filePath, 'pdf', index),
      pageContent: doc.pageContent,
      metadata: {
        type: 'pdf',
        source: doc.metadata.source,
        file: filePath,
        chunkIndex: index,
      },
    }));

    const total = await this.storeDocuments(cleanedDocs);

    console.log('\n=================================');
    console.log('PDF processing completed');
    console.log(`Stored vectors: ${total}`);
    console.log('=================================\n');

    return {
      success: true,
      total,
    };
  }

  async syncAllTargetedRepos(owner: string) {
    const allRepos = await getAllRepos(owner);

    const targetedRepos = allRepos.slice(0, -50);

    let grandTotal = 0;

    console.log('\n=================================');
    console.log(`Starting sync for ${owner}`);
    console.log(`Target repos: ${targetedRepos.length}`);
    console.log('=================================\n');

    for (const repoObj of targetedRepos) {
      const repo = repoObj.name;

      console.log(`Syncing ${owner}/${repo}...`);

      const result = await this.syncGithubRepo(owner, repo);

      grandTotal += result.total;

      console.log('');
    }

    console.log('=================================');
    console.log('MISSION SUCCESSFUL 🚀');
    console.log(`Total new vectors stored: ${grandTotal}`);
    console.log('=================================\n');

    return {
      success: true,
      grandTotal,
    };
  }

  async syncGithubRepo(owner: string, repo: string) {
    const filesToFetch = ['README.md', 'package.json'];

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const allChunks: Array<{
      id: string;
      pageContent: string;
      metadata: any;
    }> = [];

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

        if (!data.content || data.encoding !== 'base64') {
          continue;
        }

        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        if (!content.trim()) continue;

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
          id: generateChunkId(owner, repo, fileName, index),
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
        console.warn(`Failed to fetch ${fileName} from ${owner}/${repo}:`, err);
      }
    }

    if (allChunks.length === 0) {
      console.log(`No content found for ${owner}/${repo}, skipping.`);

      return {
        success: true,
        total: 0,
      };
    }

    const newChunks = await this.filterExistingChunks(allChunks);

    if (newChunks.length === 0) {
      console.log(`${owner}/${repo} → all chunks already indexed, skipping.`);

      return {
        success: true,
        total: 0,
      };
    }

    const total = await this.storeDocuments(newChunks);

    console.log(`Synced ${owner}/${repo} → ${total} new vectors stored`);

    return {
      success: true,
      total,
    };
  }
}
