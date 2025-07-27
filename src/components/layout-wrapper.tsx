'use client'

import Navigation from './navigation'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white font-sans">
      {/* Enhanced grid and grain overlay */}
      <div className="fixed inset-0 z-10 grid-overlay pointer-events-none opacity-30"></div>
      <div className="fixed inset-0 z-10 grain-overlay pointer-events-none opacity-20"></div>
      
      {/* Additional green ambient light */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-nvidia opacity-5 blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-nvidia opacity-5 blur-3xl pointer-events-none"></div>
      
      <Navigation />
      
      <main className="relative z-20 pt-24">
        {children}
      </main>
    </div>
  )
}
