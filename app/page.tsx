import { prisma } from '@/lib/prisma'
import { getOrInitConfig, checkAndAutoArchive, getAdminStatus } from '@/lib/actions'
import { EnrollForm } from './components/EnrollForm'
import { PlayerSection, WaitlistSection } from './components/PlayerSection'
import { PixSection } from './components/PixSection'
import { WhatsAppShare } from './components/WhatsAppShare'
import { AdminPanel } from './components/AdminPanel'
import { ThemeToggle } from './components/ThemeToggle'

export const dynamic = 'force-dynamic'

function getBrazilDateStr() {
  return new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
}

function getBrazilTimeStr() {
  return new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default async function HomePage() {
  await checkAndAutoArchive()

  const [config, allPlayers, adminLogado] = await Promise.all([
    getOrInitConfig(),
    prisma.jogador.findMany({ orderBy: { criadoEm: 'asc' } }),
    getAdminStatus(),
  ])

  const hoje = getBrazilDateStr()
  const agora = getBrazilTimeStr()
  const inscricoesAbertas =
    hoje < config.dataJogo ||
    (hoje === config.dataJogo && agora < config.horarioLimite)

  const espera = allPlayers.filter((p) => p.status === 'espera')

  type Categoria = 'Levantador' | 'Mulher' | 'Homem'
  const categorias: Categoria[] = ['Levantador', 'Mulher', 'Homem']

  return (
    <main className="page-wrapper">
      {/* Header */}
      <header className="header">
        <span className="header-emoji">🏐</span>
        <h1 className="header-title">Lista de Presença — Vôlei</h1>
        <div className="header-info">
          <span className="header-badge">📅 {formatDate(config.dataJogo)}</span>
          <span className="header-badge">🕐 até {config.horarioLimite}</span>
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

      {/* Enrollment Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">✍️ Insira seu nome na lista</div>
        <EnrollForm inscricoesAbertas={inscricoesAbertas} />
      </div>

      {/* Player Lists */}
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

      {/* Waitlist */}
      {espera.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <WaitlistSection players={espera} isAdmin={adminLogado} />
        </div>
      )}

      {/* PIX */}
      <div className="card" style={{ marginBottom: 16 }}>
        <PixSection chavePix={config.chavePix} />
      </div>

      {/* WhatsApp Share */}
      <div className="card" style={{ marginBottom: 16 }}>
        <WhatsAppShare
          players={allPlayers}
          dataJogo={config.dataJogo}
          horarioLimite={config.horarioLimite}
        />
      </div>

      {/* Admin Panel */}
      <AdminPanel adminLogado={adminLogado} config={config} />
      <ThemeToggle />
    </main>
  )
}
