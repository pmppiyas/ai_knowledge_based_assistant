import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
dotenv.config();
import { AppModule } from './app.module';
import { ENV } from 'src/common/config/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(ENV.PORT);
  console.log(`Server is running on port ${ENV.PORT}`);
}
void bootstrap();
