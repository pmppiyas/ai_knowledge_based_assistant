import { createHash } from 'crypto';

export function generateChunkId(doc: any) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        text: doc.pageContent,
        type: doc.metadata.type,
        repo: doc.metadata.repo ?? 'pdf',
        file: doc.metadata.file ?? doc.metadata.source ?? 'unknown',
        chunkIndex: doc.metadata.chunkIndex ?? 0,
      }),
    )
    .digest('hex');
}
