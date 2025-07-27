'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { SystemMetrics } from '../lib/supabase'

export default function Home() {
  const [vehicleCount, setVehicleCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchVehicleCount()
  }, [])

  const fetchVehicleCount = async () => {
    const { count } = await supabase
      .from('vehicle_states')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', new Date(Date.now() - 120000).toISOString())

    setVehicleCount(count || 0)
    setIsLoading(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white font-sans">
      {/* Enhanced grid and grain overlay */}
      <div className="fixed inset-0 z-10 grid-overlay pointer-events-none"></div>
      <div className="fixed inset-0 z-10 grain-overlay pointer-events-none"></div>
      
      {/* Hyphen trail animations */}
      <div className="hyphen-trail hyphen-trail-1">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
      <div className="hyphen-trail hyphen-trail-2">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
      <div className="hyphen-trail hyphen-trail-3">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
      <div className="hyphen-trail hyphen-trail-4">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
      <div className="hyphen-trail hyphen-trail-5">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
      
      {/* Additional green ambient light */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-nvidia opacity-10 blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-nvidia opacity-10 blur-3xl pointer-events-none"></div>
      
      {/* Spline 3D background */}
      <div className="fixed inset-0 z-0">
        <iframe src="https://my.spline.design/thresholddarkambientui-v0gkZCfi6zXm69kE0wccy70f/" frameBorder="0" width="100%" height="100%" className="w-full h-full"></iframe>
      </div>
      
      {/* Glass floating navbar with green undertones */}
      <nav className="fixed top-0 left-0 right-0 z-50 green-accent backdrop-blur-lg pt-4 pr-8 pb-4 pl-8 green-border-glow">
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#76b900" strokeWidth="2" opacity="0.8"></circle>
              <circle cx="12" cy="12" r="3" fill="#76b900"></circle>
              <circle cx="12" cy="12" r="6" stroke="#76b900" strokeWidth="1" opacity="0.4"></circle>
            </svg>
            <span className="ml-3 text-lg font-medium text-nvidia">Cerberus</span>
          </div>
          <div className="flex items-center space-x-12 text-sm text-gray-400">
            <a href="/dashboard" className="hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)]">Dashboard</a>
            <a href="/districts" className="hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)]">Districts</a>
            <a href="/fleets" className="hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)]">Fleet Status</a>
            <a href="/intersections" className="hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)]">Intersections</a>
            <a href="/metrics" className="hover:text-nvidia transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(118,185,0,0.5)]">Metrics</a>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">System Status:</span>
            <span className="text-sm font-medium text-nvidia">ACTIVE</span>
          </div>
        </div>
      </nav>
      
      {/* Hero content */}
      <div className="relative z-20 flex flex-col items-center justify-center px-6 pt-40 pb-32 text-center min-h-screen">
        {/* Ambient glow background */}
        <div className="absolute top-1/2 left-1/2 w-[1000px] h-[1000px] -translate-x-1/2 -translate-y-1/2 bg-nvidia opacity-5 blur-[150px] rounded-full pointer-events-none animate-pulse"></div>
        
        {/* Expanded NVIDIA badge */}
        <div className="nvidia-badge px-16 py-8 text-4xl font-bold text-black rounded-2xl mb-16 border-2 border-nvidia/50 animate-float relative">
          <span className="relative z-10">NVIDIA</span>
        </div>
        
        {/* Main CERBERUS text with enhanced glow */}
        <h1 className="text-8xl md:text-9xl lg:text-[12rem] max-w-6xl leading-none font-bold tracking-tighter text-nvidia mb-8 animate-float text-glow-nvidia">
          CERBERUS
        </h1>
        
        {/* Description with green accents */}
        <p className="text-2xl md:text-3xl lg:text-4xl max-w-4xl text-neutral-300 mt-8 leading-relaxed">
          San Francisco Autonomous Vehicle 
          <span className="text-nvidia"> Multi-Agent Coordination System</span> 
          {' '}optimizing traffic flow across 
          <span className="text-nvidia"> {isLoading ? '...' : vehicleCount}</span> active vehicles.
        </p>
        
        {/* CTA buttons with enhanced green styling */}
        <div className="mt-16 flex flex-col sm:flex-row gap-6">
          <a href="/dashboard" className="nvidia-badge px-12 py-4 text-lg font-semibold text-black rounded-full hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl relative overflow-hidden">
            <span className="relative z-10">Open Dashboard</span>
          </a>
          <a href="/simulation" className="px-12 py-4 green-accent text-nvidia text-lg font-semibold rounded-full hover:bg-nvidia hover:bg-opacity-20 transition-all duration-300 green-border-glow hover:shadow-[0_0_30px_rgba(118,185,0,0.5)]">
            Run Simulation
          </a>
        </div>
        
        {/* Additional accent elements */}
        <div className="absolute bottom-10 left-10 w-2 h-2 bg-nvidia rounded-full animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-2 h-2 bg-nvidia rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
        <div className="absolute top-40 left-20 w-1 h-1 bg-nvidia rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-nvidia rounded-full animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>
    </div>
  )
}
