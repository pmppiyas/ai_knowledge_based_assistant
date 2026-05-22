import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().min(1, 'PORT is required'),
  MODEL: z.string().min(1, 'MODEL is required'),
  APIKEY: z.string().min(1, 'APIKEY is required'),
  BASE_URL: z.string().min(1, 'BASE_URL is required'),
  EMBEDDING_MODEL: z.string().min(1, 'EMBEDDING_MODEL is required'),
  PINECONE_API_KEY: z.string().min(1, 'PINECONE_API_KEY is required'),
  PINECONE_INDEX_NAME: z.string().min(1, 'PINECONE_INDEX_NAME is required'),
});

const parsedEnv = envSchema.parse(process.env);

export const ENV = {
  PORT: parsedEnv.PORT,
  MODEL: parsedEnv.MODEL,
  EMBEDDING_MODEL: parsedEnv.EMBEDDING_MODEL,
  APIKEY: parsedEnv.APIKEY,
  BASE_URL: parsedEnv.BASE_URL,
  PINECONE_API_KEY: parsedEnv.PINECONE_API_KEY,
  PINECONE_INDEX_NAME: parsedEnv.PINECONE_INDEX_NAME,
};
