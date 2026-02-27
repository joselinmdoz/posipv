"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const config_1 = require("@nestjs/config");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const cfg = app.get(config_1.ConfigService);
    const corsOrigin = cfg.get("CORS_ORIGIN") || "http://localhost:4200";
    app.enableCors({
        origin: corsOrigin.split(",").map(s => s.trim()),
    });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const port = Number(cfg.get("PORT") || 3001);
    await app.listen(port, "0.0.0.0");
    console.log(`✅ API escuchando en 0.0.0.0:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map