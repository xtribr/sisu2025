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
      <body>
        <ScoreProvider>
          <ModalityProvider>
            {children}
          </ModalityProvider>
        </ScoreProvider>
      </body>
    </html>
  )
}
