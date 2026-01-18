import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

import { ScoreProvider } from '../context/ScoreContext'

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
        <ScoreProvider>{children}</ScoreProvider>
        <Analytics />
      </body>
    </html>
  )
}
