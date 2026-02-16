import path from 'node:path'
import { defineConfig } from 'prisma/config'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
})
