import { createHash } from 'crypto';

export function generateChunkId(
  owner: string,
  repo: string,
  file: string,
  chunkIndex: number,
): string {
  const raw = `${owner}/${repo}::${file}::${chunkIndex}`;
  return createHash('sha256').update(raw).digest('hex');
}
