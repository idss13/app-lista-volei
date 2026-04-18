import { PrismaClient } from '@prisma/client'

// Garante que o PrismaClient existe no escopo global do Node.js.
// Em desenvolvimento, o hot-reload do Next.js recria módulos a cada mudança,
// o que criaria múltiplas conexões sem esse singleton no globalThis.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Reutiliza a instância existente ou cria uma nova
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient()

// Só persiste no global em desenvolvimento — em produção não há hot-reload
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
