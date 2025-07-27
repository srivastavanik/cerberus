import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CERBERUS - SF AV Coordination Network',
  description: 'NVIDIA-powered multi-agent system for autonomous vehicle coordination in San Francisco',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full overflow-hidden`}>
        {/* Grid and grain overlay */}
        <div className="fixed inset-0 z-10 grid-overlay pointer-events-none" />
        <div className="fixed inset-0 z-10 grain-overlay pointer-events-none" />
        
        {/* Main content */}
        <main className="relative z-20 h-full">
          {children}
        </main>
      </body>
    </html>
  )
}
