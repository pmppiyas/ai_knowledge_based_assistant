import { Pinecone } from '@pinecone-database/pinecone';
import { ENV } from 'src/common/config/env.config';

const pinecone = new Pinecone({
  apiKey: ENV.PINECONE_API_KEY,
});

const pineconeIndex = pinecone.index(ENV.PINECONE_INDEX_NAME);

export { pinecone, pineconeIndex };
