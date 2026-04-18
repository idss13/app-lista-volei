'use client'

import { useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cancelEnrollment } from '@/lib/actions'
import { toast } from 'sonner'

type Player = {
  id: number
  nome: string
  categoria: string
  status: string
}

type Categoria = 'Levantador' | 'Jogador' | 'Jogadora'

// Rótulos com emoji exibidos nos badges de cada categoria
const CATEGORY_LABELS: Record<Categoria, string> = {
  Levantador: '🏐 Levantador',
  Jogador: '🏃 Jogador',
  Jogadora: '🏃‍♀️ Jogadora',
}

// Retorna o limite de vagas de cada categoria conforme a configuração do jogo.
// Jogador perde 3 vagas quando Jogadoras estão habilitadas (reservadas para elas).
function getVagas(comJogadoras: boolean): Record<Categoria, number> {
  return { Levantador: 3, Jogador: comJogadoras ? 12 : 15, Jogadora: 3 }
}

// Extrai as iniciais do nome (até 2 palavras) para exibir no avatar circular
function getInitials(nome: string) {
  return nome
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

// Card individual de um jogador, com animação de entrada/saída via Framer Motion.
// O parâmetro posicaoEspera é exibido apenas na lista de espera (1º, 2º, etc.).
function PlayerCard({
  player,
  isAdmin,
  posicaoEspera,
}: {
  player: Player
  isAdmin: boolean
  posicaoEspera?: number
}) {
  const [isPending, startTransition] = useTransition()

  // A classe CSS do avatar varia por categoria (cor) ou 'espera' (âmbar)
  const cat = player.categoria.toLowerCase() as string
  const avatarClass = player.status === 'espera' ? 'espera' : cat

  function handleRemove() {
    startTransition(async () => {
      await cancelEnrollment(player.id, player.categoria, player.status === 'oficial')
      toast.info(`${player.nome} foi removido.`)
    })
  }

  return (
    <motion.div
      className="player-card"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      // Colapsa altura e margens ao sair para que a lista acima não "pule"
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: 0.25 }}
      layout
    >
      <span className={`player-avatar ${avatarClass}`}>{getInitials(player.nome)}</span>
      {posicaoEspera !== undefined && (
        <span className="player-position">{posicaoEspera}º</span>
      )}
      <span className="player-name">{player.nome}</span>
      {isAdmin && (
        <button className="btn btn-danger" onClick={handleRemove} disabled={isPending}>
          {isPending ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Remover'}
        </button>
      )}
    </motion.div>
  )
}

// Seção de uma categoria na lista oficial.
// Exibe badge, contador de vagas e barra de progresso proporcional ao preenchimento.
export function PlayerSection({
  categoria,
  players,
  isAdmin,
  comJogadoras,
}: {
  categoria: Categoria
  players: Player[]
  isAdmin: boolean
  comJogadoras: boolean
}) {
  const vagas = getVagas(comJogadoras)[categoria]
  const oficiais = players.filter((p) => p.status === 'oficial')
  const pct = Math.min((oficiais.length / vagas) * 100, 100)
  const isFull = oficiais.length >= vagas
  const catLower = categoria.toLowerCase()

  return (
    <div className="category-section">
      <div className="category-header">
        <span className={`category-badge ${catLower}`}>
          {CATEGORY_LABELS[categoria]}
        </span>
        <span className="category-count">
          {oficiais.length}/{vagas} vagas
        </span>
      </div>

      {/* Barra de progresso — fica âmbar quando a categoria está cheia */}
      <div className="slot-bar-wrapper">
        <div className="slot-bar">
          <div
            className={`slot-bar-fill ${catLower} ${isFull ? 'full' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* AnimatePresence com mode="popLayout" anima entradas e saídas sem deslocar itens irmãos */}
      <div className="player-list">
        <AnimatePresence mode="popLayout">
          {oficiais.length === 0 ? (
            <p className="player-empty">Nenhum jogador ainda.</p>
          ) : (
            oficiais.map((p) => (
              <PlayerCard key={p.id} player={p} isAdmin={isAdmin} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Seção da fila de espera, agrupada por categoria com posição numérica (1º, 2º, etc.)
export function WaitlistSection({
  players,
  isAdmin,
}: {
  players: Player[]
  isAdmin: boolean
}) {
  if (players.length === 0) return null

  // Agrupa os jogadores por categoria mantendo a ordem original (FIFO)
  const byCategory: Record<string, Player[]> = {}
  for (const p of players) {
    if (!byCategory[p.categoria]) byCategory[p.categoria] = []
    byCategory[p.categoria].push(p)
  }

  return (
    <div>
      <div className="waitlist-title">⏱️ Lista de Espera</div>
      {Object.entries(byCategory).map(([cat, catPlayers]) => (
        <div key={cat}>
          <div className="waitlist-category-label">{cat}</div>
          <div className="player-list" style={{ marginBottom: 8 }}>
            <AnimatePresence mode="popLayout">
              {catPlayers.map((p, i) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isAdmin={isAdmin}
                  posicaoEspera={i + 1}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  )
}
