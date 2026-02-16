# =============================================================================
# Dockerfile para POS Web (Frontend Angular)
# =============================================================================
# Imagen base: Node.js 20 LTS para desarrollo
FROM docker.m.daocloud.io/node:20-alpine

# Definir variables de entorno
ENV NODE_ENV=development

# Puerto en que correrá la aplicación Angular
EXPOSE 4200

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY . .

# Comando para iniciar en modo desarrollo con hot-reload
# Angular CLIserve permite hot-reload automático
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
