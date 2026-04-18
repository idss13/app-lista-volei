import { prisma } from '@/lib/prisma'
import { getOrInitConfig, checkAndAutoArchive, getAdminStatus } from '@/lib/actions'
import { EnrollForm } from './components/EnrollForm'
import { PlayerSection, WaitlistSection } from './components/PlayerSection'
import { PixSection } from './components/PixSection'
import { WhatsAppShare } from './components/WhatsAppShare'
import { AdminPanel } from './components/AdminPanel'
import { ThemeToggle } from './components/ThemeToggle'

// Desativa o cache estático — a página precisa sempre refletir o estado atual do banco
export const dynamic = 'force-dynamic'

// Retorna a data atual no fuso de Brasília (formato YYYY-MM-DD)
function getBrazilDateStr() {
  return new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
}

// Retorna a hora atual no fuso de Brasília (formato HH:MM)
function getBrazilTimeStr() {
  return new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Converte YYYY-MM-DD para DD/MM/YYYY para exibição ao usuário
function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default async function HomePage() {
  // Arquiva automaticamente se o dia do jogo já passou antes de carregar qualquer dado
  await checkAndAutoArchive()

  // Busca configuração, jogadores e status de admin em paralelo para minimizar latência
  const [config, allPlayers, adminLogado] = await Promise.all([
    getOrInitConfig(),
    prisma.jogador.findMany({ orderBy: { criadoEm: 'asc' } }),
    getAdminStatus(),
  ])

  const hoje = getBrazilDateStr()
  const agora = getBrazilTimeStr()

  // Inscrições abertas se: a data do jogo ainda não chegou OU chegou mas ainda não passou o horário
  const inscricoesAbertas =
    hoje < config.dataJogo ||
    (hoje === config.dataJogo && agora < config.horarioLimite)

  // Jogadores na fila de espera (independente de categoria)
  const espera = allPlayers.filter((p) => p.status === 'espera')

  type Categoria = 'Levantador' | 'Jogador'
  const categorias: Categoria[] = ['Levantador', 'Jogador']

  return (
    <main className="page-wrapper">
      {/* Header com data do jogo, horário limite e indicador de inscrições abertas/fechadas */}
      <header className="header">
        <span className="header-emoji">🏐</span>
        <h1 className="header-title">Lista de Presença — Vôlei</h1>
        <div className="header-info">
          <span className="header-badge">📅 {formatDate(config.dataJogo)}</span>
          <span className="header-badge">🕐 até {config.horarioLimite}</span>
          {/* Local do jogo — exibido somente quando cadastrado pelo organizador */}
          {config.local && <span className="header-badge">📍 {config.local}</span>}
          <span className={`header-badge ${inscricoesAbertas ? 'open' : 'closed'}`}>
            {inscricoesAbertas ? (
              <>
                <span className="live-dot" />
                Inscrições abertas
              </>
            ) : (
              '🔒 Encerradas'
            )}
          </span>
        </div>
      </header>

      {/* Formulário de inscrição — desabilita automaticamente após o horário limite */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">✍️ Insira seu nome na lista</div>
        <EnrollForm inscricoesAbertas={inscricoesAbertas} />
      </div>

      {/* Lista oficial separada por categoria (Levantador, Mulher, Homem) */}
      <div
        className="card"
        style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div className="section-title">📋 Lista Oficial</div>
        <div className="divider" />
        {categorias.map((cat) => (
          <PlayerSection
            key={cat}
            categoria={cat}
            players={allPlayers.filter((p) => p.categoria === cat)}
            isAdmin={adminLogado}
          />
        ))}
      </div>

      {/* Fila de espera — só renderiza se houver jogadores aguardando */}
      {espera.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <WaitlistSection players={espera} isAdmin={adminLogado} />
        </div>
      )}

      {/* Informações de pagamento via PIX */}
      <div className="card" style={{ marginBottom: 16 }}>
        <PixSection chavePix={config.chavePix} />
      </div>

      {/* Botão para compartilhar a lista formatada no WhatsApp */}
      <div className="card" style={{ marginBottom: 16 }}>
        <WhatsAppShare
          players={allPlayers}
          dataJogo={config.dataJogo}
          horarioLimite={config.horarioLimite}
          local={config.local}
        />
      </div>

      {/* FAB do painel do organizador (canto inferior direito) */}
      <AdminPanel adminLogado={adminLogado} config={config} />

      {/* Botão de alternância de tema claro/escuro (canto inferior esquerdo) */}
      <ThemeToggle />
    </main>
  )
}
