'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LayoutWrapper from '../../components/layout-wrapper'
import type { FleetStatistics, VehicleState } from '../../lib/supabase'

const FLEET_COLORS = {
  waymo: '#4285F4',
  zoox: '#00A86B',
  cruise: '#FF6F00'
}

export default function Fleets() {
  const [fleetStats, setFleetStats] = useState<Record<string, FleetStatistics[]>>({})
  const [vehiclesByFleet, setVehiclesByFleet] = useState<Record<string, number>>({})
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null)

  useEffect(() => {
    fetchFleetData()
    
    const subscription = supabase
      .channel('fleet-statistics')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'fleet_statistics'
      }, fetchFleetData)
      .subscribe()

    const interval = setInterval(fetchFleetData, 30000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const fetchFleetData = async () => {
    // Get fleet statistics
    const { data: stats } = await supabase
      .from('fleet_statistics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      .order('timestamp', { ascending: false })

    if (stats) {
      const statsByCompany: Record<string, FleetStatistics[]> = {}
      const fleetStats = stats as unknown as FleetStatistics[]
      fleetStats.forEach(stat => {
        const company = stat.company as string
        if (!statsByCompany[company]) {
          statsByCompany[company] = []
        }
        statsByCompany[company].push(stat)
      })
      setFleetStats(statsByCompany)
    }

    // Get vehicle counts by company
    const { data: vehicles } = await supabase
      .from('vehicle_states')
      .select('company')
      .gte('timestamp', new Date(Date.now() - 120000).toISOString())

    if (vehicles) {
      const counts: Record<string, number> = {}
      const vehicleStates = vehicles as unknown as VehicleState[]
      vehicleStates.forEach(v => {
        counts[v.company] = (counts[v.company] || 0) + 1
      })
      setVehiclesByFleet(counts)
    }
  }

  const getLatestStats = (company: string): FleetStatistics | null => {
    const stats = fleetStats[company]
    return stats && stats.length > 0 ? stats[0] : null
  }

  return (
    <LayoutWrapper>
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-nvidia mb-8">Fleet Status</h1>
        
        {/* Fleet Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Object.entries(FLEET_COLORS).map(([company, color]) => {
            const stats = getLatestStats(company)
            const vehicleCount = vehiclesByFleet[company] || 0
            const isSelected = selectedFleet === company
            
            return (
              <div
                key={company}
                onClick={() => setSelectedFleet(isSelected ? null : company)}
                className={`bg-white/5 backdrop-blur-lg rounded-lg p-6 border cursor-pointer transition-all duration-300 ${
                  isSelected ? 'border-nvidia green-border-glow scale-105' : 'border-nvidia/20 hover:border-nvidia/40'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold capitalize" style={{ color }}>
                    {company}
                  </h3>
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Active Vehicles</span>
                    <span className="text-sm font-medium text-white">{vehicleCount}</span>
                  </div>
                  {stats && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Idle</span>
                        <span className="text-sm font-medium text-white">{stats.idle_vehicles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Wait Time</span>
                        <span className="text-sm font-medium text-white">
                          {stats.average_wait_time.toFixed(1)}s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Priority</span>
                        <span className="text-sm font-medium text-nvidia">{stats.priority_score}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Fleet Performance Metrics */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Fleet Performance Comparison</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.keys(FLEET_COLORS).map(company => {
              const stats = getLatestStats(company)
              if (!stats) return null
              
              return (
                <div key={company} className="text-center">
                  <h3 className="text-lg font-medium capitalize mb-3" style={{ color: FLEET_COLORS[company as keyof typeof FLEET_COLORS] }}>
                    {company}
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {((stats.active_vehicles / (stats.active_vehicles + stats.idle_vehicles)) * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-400">Utilization</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {stats.passenger_miles.toFixed(0)}
                      </div>
                      <div className="text-sm text-gray-400">Passenger Miles</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Fleet Details */}
        {selectedFleet && (
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-8 border border-nvidia/20 green-border-glow">
            <h2 className="text-2xl font-semibold capitalize mb-4" style={{ color: FLEET_COLORS[selectedFleet as keyof typeof FLEET_COLORS] }}>
              {selectedFleet} Fleet - Detailed Analytics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Recent Performance</h3>
                <div className="space-y-2">
                  {fleetStats[selectedFleet]?.slice(0, 5).map((stat, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        {new Date(stat.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-white">
                        {stat.active_vehicles} active / {stat.idle_vehicles} idle
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Fleet Configuration</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Privacy Level</span>
                    <span className="text-nvidia">
                      {selectedFleet === 'waymo' ? 'Cooperative' : 'Standard'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fleet Size</span>
                    <span className="text-white">
                      {selectedFleet === 'waymo' ? 250 : selectedFleet === 'zoox' ? 200 : 300}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coordination Rate</span>
                    <span className="text-white">High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  )
}
