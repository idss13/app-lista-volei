'use client'

import { useEffect, useState } from 'react'

// Botão de alternância entre tema claro e escuro, posicionado no canto inferior esquerdo.
// Lê e persiste a preferência no localStorage.
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  // Evita hydration mismatch: o servidor renderiza o placeholder e o cliente
  // resolve o tema real após montar, quando o localStorage já está acessível.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('theme')
    setIsDark(stored !== 'light')
  }, [])

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setIsDark(!isDark)
  }

  // Placeholder com as mesmas dimensões do botão para não deslocar o layout durante a hidratação
  if (!mounted) return <div className="theme-toggle-placeholder" />

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
