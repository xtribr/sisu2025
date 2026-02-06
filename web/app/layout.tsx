import type { Metadata } from 'next'
import './globals.css'

import { ScoreProvider } from '../context/ScoreContext'
import { ModalityProvider } from '../context/ModalityContext'

export const metadata: Metadata = {
  title: 'XTRI SISU 2026 - Simulador',
  description: 'Monitoramento do SISU 2026 em Tempo Real - Compare suas notas e descubra suas chances de aprovação',
  icons: {
    icon: '/favicon.png',
    apple: '/xtri-logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Pular para conteúdo principal
        </a>
        <ScoreProvider>
          <ModalityProvider>
            <main id="main-content">
              {children}
            </main>
          </ModalityProvider>
        </ScoreProvider>
      </body>
    </html>
  )
}
