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

type Categoria = 'Levantador' | 'Mulher' | 'Homem'

const VAGAS: Record<Categoria, number> = { Levantador: 3, Mulher: 3, Homem: 12 }

const CATEGORY_LABELS: Record<Categoria, string> = {
  Levantador: '🏐 Levantador',
  Mulher: '👩 Mulher',
  Homem: '👨 Homem',
}

function getInitials(nome: string) {
  return nome
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

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

export function PlayerSection({
  categoria,
  players,
  isAdmin,
}: {
  categoria: Categoria
  players: Player[]
  isAdmin: boolean
}) {
  const vagas = VAGAS[categoria]
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

      <div className="slot-bar-wrapper">
        <div className="slot-bar">
          <div
            className={`slot-bar-fill ${catLower} ${isFull ? 'full' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

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

export function WaitlistSection({
  players,
  isAdmin,
}: {
  players: Player[]
  isAdmin: boolean
}) {
  if (players.length === 0) return null

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
