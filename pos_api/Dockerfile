# =============================================================================
# Dockerfile para POS API (Backend NestJS)
# - `production`: imagen lista para despliegue
# - `development`: hot-reload para docker-compose.dev.yml (stage por defecto)
# =============================================================================

FROM node:20-alpine AS base
WORKDIR /app
EXPOSE 3021

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM base AS production
ENV NODE_ENV=production
ENV PORT=3021
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN mkdir -p uploads && chmod 755 uploads
CMD ["node", "dist/src/main.js"]

FROM base AS development
ENV NODE_ENV=development
ENV PORT=3021
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN mkdir -p uploads && chmod 755 uploads
CMD ["./node_modules/.bin/nest", "start", "--watch"]
