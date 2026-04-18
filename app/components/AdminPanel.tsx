'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  loginAdmin,
  logoutAdmin,
  updateSettings,
  getHistoricoData,
  getHistoricoPorData,
  type ActionState,
} from '@/lib/actions'
import { toast } from 'sonner'

type Config = {
  horarioLimite: string
  chavePix: string
  dataJogo: string
}

type HistoryPlayer = {
  id: number
  nome: string
  categoria: string
  status: string
}

function LoginForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(loginAdmin, null)

  useEffect(() => {
    if (state?.success) { toast.success(state.success); onClose() }
    if (state?.error) toast.error(state.error)
  }, [state, onClose])

  return (
    <form action={formAction} className="admin-form">
      <div className="form-field">
        <label className="form-label">Senha do Organizador</label>
        <input
          name="senha"
          type="password"
          className="form-input"
          placeholder="••••••••"
          required
          autoFocus
        />
      </div>
      <button type="submit" className="btn btn-amber w-full" disabled={isPending}>
        {isPending ? <><span className="spinner" /> Verificando...</> : '🔑 Entrar'}
      </button>
    </form>
  )
}

function SettingsForm({ config, onClose }: { config: Config; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateSettings,
    null
  )
  const [historyDates, setHistoryDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [historyData, setHistoryData] = useState<HistoryPlayer[]>([])
  const [isLoadingHistory, startHistoryTransition] = useTransition()
  const [isLoggingOut, startLogoutTransition] = useTransition()

  useEffect(() => {
    if (state?.success) toast.success(state.success)
    if (state?.error) toast.error(state.error)
  }, [state])

  useEffect(() => {
    startHistoryTransition(async () => {
      const dates = await getHistoricoData()
      setHistoryDates(dates)
    })
  }, [])

  function handleDateChange(date: string) {
    setSelectedDate(date)
    if (!date) { setHistoryData([]); return }
    startHistoryTransition(async () => {
      const data = await getHistoricoPorData(date)
      setHistoryData(data as HistoryPlayer[])
    })
  }

  function handleLogout() {
    startLogoutTransition(async () => {
      await logoutAdmin()
      onClose()
      toast.info('Sessão encerrada.')
    })
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div>
      <div className="admin-logged-badge">
        <span>✅</span> Modo Organizador Ativo
      </div>

      <form action={formAction} className="admin-form">
        <div className="form-field">
          <label className="form-label">Data do Jogo</label>
          <input
            name="dataJogo"
            type="date"
            className="form-input"
            defaultValue={config.dataJogo}
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label">Horário Limite (HH:MM)</label>
          <input
            name="horarioLimite"
            type="time"
            className="form-input"
            defaultValue={config.horarioLimite}
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label">Chave PIX</label>
          <input
            name="chavePix"
            type="text"
            className="form-input"
            defaultValue={config.chavePix}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
          {isPending ? <><span className="spinner" /> Salvando...</> : '💾 Salvar Configurações'}
        </button>
      </form>

      <div className="divider" style={{ margin: '20px 0' }} />

      <div>
        <div className="section-title" style={{ fontSize: '0.9rem', marginBottom: 10 }}>
          📚 Histórico de Partidas
        </div>
        {historyDates.length === 0 ? (
          <p className="text-muted">Nenhum histórico arquivado ainda.</p>
        ) : (
          <>
            <select
              className="history-select"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
            >
              <option value="">Selecione uma data...</option>
              {historyDates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </select>

            {isLoadingHistory && <p className="text-muted text-center">Carregando...</p>}

            {!isLoadingHistory && historyData.length > 0 && (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Posição</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{p.categoria}</td>
                      <td>
                        <span className={`status-chip ${p.status}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className="divider" style={{ margin: '20px 0' }} />

      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? 'Saindo...' : '🚪 Sair'}
      </button>
    </div>
  )
}

export function AdminPanel({
  adminLogado,
  config,
}: {
  adminLogado: boolean
  config: Config
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        className={`admin-fab ${adminLogado ? 'active' : ''}`}
        onClick={() => setIsOpen(true)}
        title="Área do Organizador"
        aria-label="Área do Organizador"
      >
        {adminLogado ? '⚙️' : '🔒'}
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {adminLogado ? '⚙️ Painel do Organizador' : '🔒 Área Restrita'}
              </span>
              <button className="modal-close" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            {adminLogado ? (
              <SettingsForm config={config} onClose={() => setIsOpen(false)} />
            ) : (
              <LoginForm onClose={() => setIsOpen(false)} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
