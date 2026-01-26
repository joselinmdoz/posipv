import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg = app.get(ConfigService);

  const corsOrigin = cfg.get<string>("CORS_ORIGIN") || "http://localhost:4200";
  app.enableCors({
    origin: corsOrigin.split(",").map(s => s.trim()),
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(cfg.get<string>("PORT") || 3001);
  await app.listen(port, 'localhost');
  console.log(`✅ API en http://localhost:${port}/api`);
}

bootstrap();
