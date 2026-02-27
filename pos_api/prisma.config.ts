import path from 'node:path'
import { defineConfig } from 'prisma/config'
import dotenv from 'dotenv'

// Cargar variables de entorno en silencio para no contaminar salidas CLI (migrate diff --script)
dotenv.config({ quiet: true })

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos',
  },
})
