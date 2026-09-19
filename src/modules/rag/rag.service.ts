import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Injectable } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ENV } from 'src/common/config/env.config';
import { pinecone, pineconeIndex } from 'src/common/config/pinecone.config';
import { generateChunkId } from 'src/common/utils/generateChunkId';
import { getAllRepos } from 'src/common/utils/getAllRepos';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RagService {
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

  private async storeDocuments(cleanedDocs: any[]) {
    const vectors = (
      await Promise.all(
        cleanedDocs.map(async (doc) => {
          const values = await this.getEmbedding(doc.pageContent);
          if (!values || values.length === 0) return null;

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

    try {
      const generatedDim = vectors[0]?.values?.length;
      console.log(
        `[Pinecone Upsert] Preparing to upsert ${vectors.length} vectors (Generated Vector Dimension: ${generatedDim})`,
      );

      try {
        const indexDescription = await pinecone.describeIndex(
          ENV.PINECONE_INDEX_NAME,
        );
        console.log(
          `[Pinecone Index Info] Index "${ENV.PINECONE_INDEX_NAME}" dimension: ${indexDescription.dimension}`,
        );
        if (indexDescription.dimension !== generatedDim) {
          const mismatchMsg = `Dimension Mismatch Error: Pinecone Index "${ENV.PINECONE_INDEX_NAME}" is configured for ${indexDescription.dimension} dimensions, but embedding model "${ENV.EMBEDDING_MODEL}" produced ${generatedDim} dimensions!`;
          console.error(`\n❌ [CRITICAL PINECONE ERROR] ${mismatchMsg}\n`);
          throw new Error(mismatchMsg);
        }
      } catch (descErr: any) {
        if (descErr?.message?.includes('Dimension Mismatch')) throw descErr;
        console.warn('[Pinecone describeIndex warning]:', descErr?.message);
      }

      await pineconeIndex.upsert({ records: vectors });
      return vectors.length;
    } catch (err: any) {
      console.error('❌ [Pinecone Upsert Error]:', err?.message || err);
      if (err?.name) console.error('Error Type:', err.name);
      if (err?.status) console.error('HTTP Status:', err.status);
      throw err;
    }
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
      id: generateChunkId('pdf', 'resume', 'cv', index),
      pageContent: doc.pageContent,
      metadata: {
        type: 'pdf',
        source: 'resume',
        file: filePath,
        chunkIndex: index,
      },
    }));

    const total = await this.storeDocuments(cleanedDocs);

    console.log('\n=================================');
    console.log('PDF processing completed');
    console.log(`Stored vectors: ${total}`);
    console.log('==================================\n');

    return {
      success: true,
      total,
    };
  }

  async syncAllTargetedRepos(owner: string, forceUpdate: boolean = false) {
    const allRepos = await getAllRepos(owner);

    const targetedRepos = allRepos.slice(0, 50);

    let grandTotal = 0;

    console.log('\n=================================');
    console.log(`Starting sync for ${owner}`);
    console.log(`Target repos: ${targetedRepos.length}`);
    console.log('=================================\n');

    for (const repoObj of targetedRepos) {
      const repo = repoObj.name;

      console.log(`Syncing ${owner}/${repo}...`);

      const result = await this.syncGithubRepo(owner, repo, forceUpdate);

      grandTotal += result.total;

      console.log('');
    }

    console.log('=================================');
    console.log('MISSION SUCCESSFUL 🚀');
    console.log(`Total new/updated vectors stored: ${grandTotal}`);
    console.log('=================================\n');

    return {
      success: true,
      grandTotal,
      reposProcessed: targetedRepos.length,
    };
  }

  async syncGithubRepo(
    owner: string,
    repo: string,
    forceUpdate: boolean = false,
  ) {
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

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PrinceMahmudPiyas-Portfolio-Assistant',
    };

    if (ENV.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${ENV.GITHUB_TOKEN}`;
    }

    for (const fileName of filesToFetch) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
          { headers },
        );

        if (!response.ok) {
          if (response.status !== 404) {
            const errText = await response.text();
            console.warn(
              `[GitHub Repo File Fetch] ${owner}/${repo} ${fileName} returned HTTP ${response.status}: ${errText}`,
            );
          }
          continue;
        }

        const data = await response.json();

        if (!data.content || data.encoding !== 'base64') {
          continue;
        }

        let content = Buffer.from(data.content, 'base64').toString('utf-8');

        if (!content.trim()) continue;

        if (fileName === 'README.md') {
          const isNextBoilerplate =
            content.includes('bootstrapped with [`create-next-app`]') ||
            content.includes('bootstrapped with [create-next-app]') ||
            (content.includes('Deploy on Vercel') &&
              content.includes('The easiest way to deploy your Next.js app'));

          if (isNextBoilerplate) {
            const cleanedContent = content
              .replace(/## Getting Started[\s\S]*?(?=##|$)/gi, '')
              .replace(/## Deploy on Vercel[\s\S]*?(?=##|$)/gi, '')
              .replace(/## Learn More[\s\S]*?(?=##|$)/gi, '')
              .replace(
                /This is a \[Next\.js\]\(https:\/\/nextjs\.org\).*?create-next-app\./gi,
                '',
              )
              .trim();

            if (cleanedContent.length < 50) {
              console.log(
                `Skipping default Next.js boilerplate README for ${owner}/${repo}`,
              );
              continue;
            }
            content = cleanedContent;
          }
        }

        if (fileName === 'package.json') {
          try {
            const pkg = JSON.parse(content);
            const deps = Object.keys(pkg.dependencies || {}).join(', ');
            content = `Project Name: ${pkg.name || repo}\nDescription: ${pkg.description || 'Project by Prince Mahmud Piyas'}\nKey Technologies & Dependencies: ${deps || 'None'}`;
          } catch {}
        }

        const fileDoc = {
          pageContent: `Repository: ${owner}/${repo}\nFile: ${fileName}\n\n${content}`,
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
      } catch (err: any) {
        console.warn(
          `Failed to fetch ${fileName} from ${owner}/${repo}:`,
          err?.message || err,
        );
      }
    }

    if (allChunks.length === 0) {
      console.log(`No content found for ${owner}/${repo}, skipping.`);

      return {
        success: true,
        total: 0,
      };
    }

    let chunksToStore = allChunks;
    if (!forceUpdate) {
      chunksToStore = await this.filterExistingChunks(allChunks);

      if (chunksToStore.length === 0) {
        console.log(`${owner}/${repo} → all chunks already indexed, skipping.`);

        return {
          success: true,
          total: 0,
        };
      }
    }

    const total = await this.storeDocuments(chunksToStore);

    console.log(
      `Synced ${owner}/${repo} → ${total} new/updated vectors stored`,
    );

    return {
      success: true,
      total,
    };
  }

  async clearIndex() {
    try {
      await pineconeIndex.deleteAll();
      console.log('Pinecone index cleared successfully.');
      return {
        success: true,
        message: 'Pinecone index cleared successfully',
      };
    } catch (err: any) {
      console.error('Failed to clear Pinecone index:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async reindexLatestPdf() {
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) {
      return { success: false, message: 'Uploads directory not found' };
    }

    const files = fs.readdirSync(uploadsDir);
    if (files.length === 0) {
      return { success: false, message: 'No files in uploads directory' };
    }

    const validFiles = files
      .map((file) => ({
        file,
        time: fs.statSync(path.join(uploadsDir, file)).mtime.getTime(),
        size: fs.statSync(path.join(uploadsDir, file)).size,
      }))
      .filter((f) => f.size > 0)
      .sort((a, b) => b.time - a.time);

    if (validFiles.length === 0) {
      return { success: false, message: 'No valid files in uploads' };
    }

    const targetFile = path.join(uploadsDir, validFiles[0].file);
    console.log(`Reindexing latest PDF file: ${targetFile}`);
    return this.processPdf(targetFile);
  }
}
