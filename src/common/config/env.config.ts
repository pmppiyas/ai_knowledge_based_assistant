import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().min(1, 'PORT is required'),
  MODEL: z.string().min(1, 'MODEL is required'),
  APIKEY: z.string().min(1, 'APIKEY is required'),
});

const parsedEnv = envSchema.parse(process.env);

export const ENV = {
  PORT: parsedEnv.PORT,
  MODEL: parsedEnv.MODEL,
  APIKEY: parsedEnv.APIKEY,
};
