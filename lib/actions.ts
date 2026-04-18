'use server'

import { prisma } from './prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

// Tipo de retorno padrão das Server Actions — usado pelo useActionState nos componentes
export type ActionState = { error?: string; success?: string } | null

// Limite de vagas por categoria. Levantador tem vagas reduzidas pelo formato do jogo.
const VAGAS = { Levantador: 3, Jogador: 15 } as const

// Retorna a data atual no fuso horário de Brasília no formato YYYY-MM-DD (locale 'sv' = ISO)
function getBrazilDateStr(): string {
  return new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
}

// Retorna a hora atual no fuso horário de Brasília no formato HH:MM (sem segundos)
function getBrazilTimeStr(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Busca a configuração do banco ou cria um registro padrão se ainda não existir.
// O registro tem id fixo 1 — só existe uma configuração global no sistema.
export async function getOrInitConfig() {
  let config = await prisma.config.findUnique({ where: { id: 1 } })
  if (!config) {
    config = await prisma.config.create({
      data: {
        id: 1,
        horarioLimite: '20:00',
        chavePix: 'Sua chave PIX aqui',
        dataJogo: getBrazilDateStr(),
        local: '',
      },
    })
  }
  return config
}

// Verifica se a data do jogo já passou e, se sim, arquiva a lista atual e avança para a próxima semana.
// Chamada automaticamente no carregamento da página principal.
// Retorna true se o arquivamento foi executado.
export async function checkAndAutoArchive(): Promise<boolean> {
  const config = await getOrInitConfig()
  const hoje = getBrazilDateStr()

  // Se ainda não chegou o dia do jogo, não há nada a arquivar
  if (hoje <= config.dataJogo) return false

  // Copia todos os jogadores atuais para o histórico antes de limpar
  const jogadores = await prisma.jogador.findMany()
  if (jogadores.length > 0) {
    await prisma.historicoJogador.createMany({
      data: jogadores.map((j) => ({
        nome: j.nome,
        categoria: j.categoria,
        status: j.status,
        // Hora fixa T12:00:00Z evita problemas de fuso que fariam o Date virar um dia anterior
        dataJogo: new Date(config.dataJogo + 'T12:00:00Z'),
      })),
    })
  }

  // Limpa a lista ativa para o próximo jogo
  await prisma.jogador.deleteMany()

  // Avança a data do jogo para daqui a 7 dias; se já tiver passado, usa hoje
  const dataJogoMs = new Date(config.dataJogo + 'T12:00:00Z').getTime()
  let novaDataMs = dataJogoMs + 7 * 24 * 60 * 60 * 1000
  const hojeMs = new Date(hoje + 'T12:00:00Z').getTime()
  if (novaDataMs < hojeMs) novaDataMs = hojeMs

  const novaData = new Date(novaDataMs).toISOString().split('T')[0]
  await prisma.config.update({ where: { id: 1 }, data: { dataJogo: novaData } })

  return true
}

// Verifica se o cookie de sessão do organizador está presente e válido
export async function getAdminStatus(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('admin_logado')?.value === 'true'
}

// Valida a senha do organizador e cria um cookie de sessão httpOnly por 8 horas
export async function loginAdmin(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const senha = formData.get('senha') as string
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  if (senha !== adminPassword) return { error: 'Senha incorreta!' }

  const cookieStore = await cookies()
  cookieStore.set('admin_logado', 'true', {
    httpOnly: true,   // impede acesso pelo JavaScript do cliente
    sameSite: 'strict',
    maxAge: 60 * 60 * 8, // 8 horas em segundos
    path: '/',
  })

  revalidatePath('/')
  return { success: 'Bem-vindo, organizador!' }
}

// Remove o cookie de sessão do organizador
export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('admin_logado')
  revalidatePath('/')
}

// Inscreve um jogador no jogo atual.
// Regras: nome não vazio, inscrições abertas, nome único (case-insensitive),
// status "oficial" se há vagas ou "espera" se a categoria está cheia.
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

  // Bloqueia inscrição se já passou o horário limite no dia do jogo
  if (hoje === config.dataJogo && agora >= config.horarioLimite) {
    return { error: `Inscrições encerradas! O horário limite era ${config.horarioLimite}.` }
  }

  // Impede nomes duplicados (insensível a maiúsculas/minúsculas)
  const existente = await prisma.jogador.findFirst({
    where: { nome: { equals: nome, mode: 'insensitive' } },
  })
  if (existente) return { error: `O nome "${nome}" já está na lista!` }

  // Conta quantos oficiais já existem nessa categoria para decidir o status
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

// Remove um jogador da lista. Se era oficial, promove o primeiro da fila de espera da mesma categoria.
export async function cancelEnrollment(
  id: number,
  categoria: string,
  eraOficial: boolean
): Promise<void> {
  await prisma.jogador.delete({ where: { id } })

  // Promoção automática: só faz sentido se a vaga era oficial
  if (eraOficial) {
    const espera = await prisma.jogador.findFirst({
      where: { categoria, status: 'espera' },
      orderBy: { criadoEm: 'asc' }, // FIFO — o mais antigo sobe primeiro
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

// Atualiza as configurações do jogo (data, horário limite, chave PIX e local)
export async function updateSettings(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const horarioLimite = formData.get('horarioLimite') as string
  const chavePix = formData.get('chavePix') as string
  const dataJogo = formData.get('dataJogo') as string
  const local = formData.get('local') as string

  await prisma.config.update({
    where: { id: 1 },
    data: { horarioLimite, chavePix, dataJogo, local },
  })

  revalidatePath('/')
  return { success: 'Configurações salvas com sucesso!' }
}

// Retorna a lista de datas com histórico arquivado (mais recente primeiro)
export async function getHistoricoData(): Promise<string[]> {
  const datas = await prisma.historicoJogador.findMany({
    select: { dataJogo: true },
    distinct: ['dataJogo'],
    orderBy: { dataJogo: 'desc' },
  })
  return datas.map((d) => d.dataJogo.toISOString().split('T')[0])
}

// Retorna todos os jogadores arquivados de uma data específica,
// ordenados por status → categoria → ordem de inscrição
export async function getHistoricoPorData(dataJogo: string) {
  return prisma.historicoJogador.findMany({
    where: { dataJogo: new Date(dataJogo + 'T12:00:00Z') },
    orderBy: [{ status: 'asc' }, { categoria: 'asc' }, { arquivadoEm: 'asc' }],
  })
}
