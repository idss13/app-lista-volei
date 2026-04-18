'use client'

import { useActionState, useEffect } from 'react'
import { enrollPlayer, type ActionState } from '@/lib/actions'
import { toast } from 'sonner'

// Formulário de inscrição de jogadores.
// Usa useActionState para integrar com a Server Action enrollPlayer sem JavaScript extra.
export function EnrollForm({
  inscricoesAbertas,
  comJogadoras,
}: {
  inscricoesAbertas: boolean
  comJogadoras: boolean
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    enrollPlayer,
    null
  )

  // Dispara toast de sucesso ou erro sempre que a action retorna um novo estado
  useEffect(() => {
    if (state?.success) toast.success(state.success)
    if (state?.error) toast.error(state.error)
  }, [state])

  // Exibe aviso estático quando as inscrições já foram encerradas
  if (!inscricoesAbertas) {
    return (
      <div className="closed-notice">
        ⏳ Inscrições encerradas para hoje!
      </div>
    )
  }

  return (
    <form action={formAction} className="enroll-form">
      <div className="form-row">
        {/* flex: 2 no nome e flex: 1 na categoria para ocupar 2/3 e 1/3 da linha */}
        <input
          name="nome"
          className="form-input"
          placeholder="Seu nome completo..."
          required
          autoComplete="off"
          style={{ flex: 2 }}
        />
        {/* Jogadora só aparece quando o organizador habilitou vagas femininas */}
        <select name="categoria" className="form-select" style={{ flex: 1 }}>
          <option value="Jogador">Jogador</option>
          {comJogadoras && <option value="Jogadora">Jogadora</option>}
          <option value="Levantador">Levantador</option>
        </select>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
        {/* Spinner enquanto a action está em andamento para evitar cliques duplos */}
        {isPending ? (
          <>
            <span className="spinner" />
            Adicionando...
          </>
        ) : (
          '⚡ Entrar na Lista'
        )}
      </button>
    </form>
  )
}
