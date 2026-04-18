'use client'

import { useActionState, useEffect } from 'react'
import { enrollPlayer, type ActionState } from '@/lib/actions'
import { toast } from 'sonner'

export function EnrollForm({ inscricoesAbertas }: { inscricoesAbertas: boolean }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    enrollPlayer,
    null
  )

  useEffect(() => {
    if (state?.success) toast.success(state.success)
    if (state?.error) toast.error(state.error)
  }, [state])

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
        <input
          name="nome"
          className="form-input"
          placeholder="Seu nome completo..."
          required
          autoComplete="off"
          style={{ flex: 2 }}
        />
        <select name="categoria" className="form-select" style={{ flex: 1 }}>
          <option value="Homem">Homem</option>
          <option value="Mulher">Mulher</option>
          <option value="Levantador">Levantador</option>
        </select>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
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
