'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export type ActionState = { error?: string; success?: string } | null

const VAGAS = { Levantador: 3, Mulher: 3, Homem: 12 } as const

function getBrazilDateStr(): string {
  return new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
}

function getBrazilTimeStr(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function getOrInitConfig() {
  let config = await prisma.config.findUnique({ where: { id: 1 } })
  if (!config) {
    config = await prisma.config.create({
      data: {
        id: 1,
        horarioLimite: '20:00',
        chavePix: 'Sua chave PIX aqui',
        dataJogo: getBrazilDateStr(),
      },
    })
  }
  return config
}

export async function checkAndAutoArchive(): Promise<boolean> {
  const config = await getOrInitConfig()
  const hoje = getBrazilDateStr()

  if (hoje <= config.dataJogo) return false

  const jogadores = await prisma.jogador.findMany()
  if (jogadores.length > 0) {
    await prisma.historicoJogador.createMany({
      data: jogadores.map((j) => ({
        nome: j.nome,
        categoria: j.categoria,
        status: j.status,
        dataJogo: new Date(config.dataJogo + 'T12:00:00Z'),
      })),
    })
  }

  await prisma.jogador.deleteMany()

  const dataJogoMs = new Date(config.dataJogo + 'T12:00:00Z').getTime()
  let novaDataMs = dataJogoMs + 7 * 24 * 60 * 60 * 1000
  const hojeMs = new Date(hoje + 'T12:00:00Z').getTime()
  if (novaDataMs < hojeMs) novaDataMs = hojeMs

  const novaData = new Date(novaDataMs).toISOString().split('T')[0]
  await prisma.config.update({ where: { id: 1 }, data: { dataJogo: novaData } })

  return true
}

export async function getAdminStatus(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('admin_logado')?.value === 'true'
}

export async function loginAdmin(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const senha = formData.get('senha') as string
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  if (senha !== adminPassword) return { error: 'Senha incorreta!' }

  const cookieStore = await cookies()
  cookieStore.set('admin_logado', 'true', {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  revalidatePath('/')
  return { success: 'Bem-vindo, organizador!' }
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('admin_logado')
  revalidatePath('/')
}

export async function enrollPlayer(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const nome = (formData.get('nome') as string)?.trim()
  const categoria = formData.get('categoria') as string

  if (!nome) return { error: 'Por favor, informe um nome válido.' }

  const config = await getOrInitConfig()
  const hoje = getBrazilDateStr()
  const agora = getBrazilTimeStr()

  if (hoje === config.dataJogo && agora >= config.horarioLimite) {
    return { error: `Inscrições encerradas! O horário limite era ${config.horarioLimite}.` }
  }

  const existente = await prisma.jogador.findFirst({
    where: { nome: { equals: nome, mode: 'insensitive' } },
  })
  if (existente) return { error: `O nome "${nome}" já está na lista!` }

  const oficiais = await prisma.jogador.count({
    where: { categoria, status: 'oficial' },
  })

  const limite = VAGAS[categoria as keyof typeof VAGAS] ?? 12
  const status = oficiais < limite ? 'oficial' : 'espera'

  await prisma.jogador.create({ data: { nome, categoria, status } })

  revalidatePath('/')
  return {
    success:
      status === 'oficial'
        ? '✅ Confirmado na lista oficial!'
        : '⚠️ Vagas esgotadas. Adicionado à fila de espera!',
  }
}

export async function cancelEnrollment(
  id: number,
  categoria: string,
  eraOficial: boolean
): Promise<void> {
  await prisma.jogador.delete({ where: { id } })

  if (eraOficial) {
    const espera = await prisma.jogador.findFirst({
      where: { categoria, status: 'espera' },
      orderBy: { criadoEm: 'asc' },
    })
    if (espera) {
      await prisma.jogador.update({
        where: { id: espera.id },
        data: { status: 'oficial' },
      })
    }
  }

  revalidatePath('/')
}

export async function updateSettings(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const horarioLimite = formData.get('horarioLimite') as string
  const chavePix = formData.get('chavePix') as string
  const dataJogo = formData.get('dataJogo') as string

  await prisma.config.update({
    where: { id: 1 },
    data: { horarioLimite, chavePix, dataJogo },
  })

  revalidatePath('/')
  return { success: 'Configurações salvas com sucesso!' }
}

export async function getHistoricoData(): Promise<string[]> {
  const datas = await prisma.historicoJogador.findMany({
    select: { dataJogo: true },
    distinct: ['dataJogo'],
    orderBy: { dataJogo: 'desc' },
  })
  return datas.map((d) => d.dataJogo.toISOString().split('T')[0])
}

export async function getHistoricoPorData(dataJogo: string) {
  return prisma.historicoJogador.findMany({
    where: { dataJogo: new Date(dataJogo + 'T12:00:00Z') },
    orderBy: [{ status: 'asc' }, { categoria: 'asc' }, { arquivadoEm: 'asc' }],
  })
}
