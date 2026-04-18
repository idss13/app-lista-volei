'use client'

import { toast } from 'sonner'

// Exibe a chave PIX do organizador e permite copiá-la com um clique
export function PixSection({ chavePix }: { chavePix: string }) {
  function handleCopy() {
    navigator.clipboard.writeText(chavePix).then(() => {
      toast.success('Chave PIX copiada!')
    })
  }

  return (
    <div className="pix-section">
      <div className="pix-title">💳 Pagamento da Quadra</div>
      <p className="pix-subtitle">
        Realize o pagamento via PIX para garantir sua vaga.
      </p>
      {/* O botão inteiro é clicável para facilitar o toque em mobile */}
      <button className="pix-key-box" onClick={handleCopy} type="button">
        <span className="pix-key-text">{chavePix}</span>
        <span className="pix-copy-icon" title="Copiar">📋</span>
      </button>
      <p className="text-muted mt-4">Toque para copiar a chave</p>
    </div>
  )
}
