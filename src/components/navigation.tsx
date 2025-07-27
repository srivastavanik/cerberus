'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()
  
  const isActive = (path: string) => pathname === path
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 green-accent backdrop-blur-lg pt-4 pr-8 pb-4 pl-8 green-border-glow">
      <div className="flex items-center justify-between max-w-full">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#76b900" strokeWidth="2" opacity="0.8"></circle>
              <circle cx="12" cy="12" r="3" fill="#76b900"></circle>
              <circle cx="12" cy="12" r="6" stroke="#76b900" strokeWidth="1" opacity="0.4"></circle>
            </svg>
            <span className="ml-3 text-lg font-medium text-nvidia">Cerberus</span>
          </Link>
        </div>
        <div className="flex items-center space-x-12 text-sm text-gray-400">
          <Link 
            href="/dashboard" 
            className={`hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)] ${isActive('/dashboard') ? 'text-nvidia' : ''}`}
          >
            Dashboard
          </Link>
          <Link 
            href="/districts" 
            className={`hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)] ${isActive('/districts') ? 'text-nvidia' : ''}`}
          >
            Districts
          </Link>
          <Link 
            href="/fleets" 
            className={`hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)] ${isActive('/fleets') ? 'text-nvidia' : ''}`}
          >
            Fleet Status
          </Link>
          <Link 
            href="/intersections" 
            className={`hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)] ${isActive('/intersections') ? 'text-nvidia' : ''}`}
          >
            Intersections
          </Link>
          <Link 
            href="/metrics" 
            className={`hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)] ${isActive('/metrics') ? 'text-nvidia' : ''}`}
          >
            Metrics
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">System Status:</span>
          <span className="text-sm font-medium text-nvidia">ACTIVE</span>
        </div>
      </div>
    </nav>
  )
}
