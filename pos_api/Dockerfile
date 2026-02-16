# =============================================================================
# Dockerfile para POS API (Backend NestJS)
# =============================================================================
# Imagen base: Node.js 20 LTS
FROM docker.m.daocloud.io/node:20-alpine

# Definir variables de entorno
ENV NODE_ENV=development
ENV PORT=3021

# Puerto en que correrá la aplicación
EXPOSE 3021

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de package.json y package-lock.json
COPY package*.json ./

# Instalar todas las dependencias (incluyendo dev para nest CLI)
RUN npm install

# Copiar código fuente
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

# Crear directorio de uploads
RUN mkdir -p uploads && chmod 755 uploads

# Exponer puerto para la base de datos (interno)
# La conexión se hace a través de la variable DATABASE_URL

# Comando para iniciar en modo desarrollo con hot-reload
CMD ["./node_modules/.bin/nest", "start", "--watch"]
