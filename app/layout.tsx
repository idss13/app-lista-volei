import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Vôlei - Lista de Presença',
  description: 'Lista de presença para o jogo de vôlei',
}

// Script inline executado antes da hidratação para aplicar o tema salvo no localStorage.
// Sem isso, a página pisca com o tema padrão (dark) antes de ler a preferência do usuário.
// Deve ficar no <head> e ser síncrono — por isso usa dangerouslySetInnerHTML.
const themeScript = `
  (function() {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning necessário porque o script acima modifica data-theme
    // antes da hidratação, causando diferença entre o HTML do servidor e do cliente
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        {/* Toaster global para notificações de sucesso/erro em todas as Server Actions */}
        <Toaster richColors position="top-center" duration={3500} />
      </body>
    </html>
  )
}
