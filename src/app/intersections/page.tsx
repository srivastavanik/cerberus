'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LayoutWrapper from '../../components/layout-wrapper'
import type { IntersectionState } from '../../lib/supabase'

export default function Intersections() {
  const [intersections, setIntersections] = useState<IntersectionState[]>([])
  const [selectedIntersection, setSelectedIntersection] = useState<string | null>(null)
  const [realtimeUpdates, setRealtimeUpdates] = useState<Record<string, any>>({})

  useEffect(() => {
    fetchIntersections()
    
    const subscription = supabase
      .channel('intersection-states')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'intersection_states'
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const update = payload.new as IntersectionState
          setRealtimeUpdates(prev => ({
            ...prev,
            [update.intersection_id]: update
          }))
        }
      })
      .subscribe()

    const interval = setInterval(fetchIntersections, 30000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const fetchIntersections = async () => {
    const { data } = await supabase
      .from('intersection_states')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString())
      .order('timestamp', { ascending: false })

    if (data) {
      // Get latest state for each intersection
      const latestByIntersection: Record<string, IntersectionState> = {}
      const states = data as unknown as IntersectionState[]
      states.forEach(state => {
        if (!latestByIntersection[state.intersection_id] || 
            new Date(state.timestamp) > new Date(latestByIntersection[state.intersection_id].timestamp)) {
          latestByIntersection[state.intersection_id] = state
        }
      })
      setIntersections(Object.values(latestByIntersection))
    }
  }

  const getTrafficLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getPhaseColor = (phase: string) => {
    if (phase?.includes('green')) return 'bg-green-500'
    if (phase?.includes('yellow')) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <LayoutWrapper>
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-nvidia mb-8">Intersection Management</h1>
        
        {/* Active Intersections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {intersections.map(intersection => {
            const isSelected = selectedIntersection === intersection.intersection_id
            const realtimeData = realtimeUpdates[intersection.intersection_id] || intersection
            
            return (
              <div
                key={intersection.intersection_id}
                onClick={() => setSelectedIntersection(isSelected ? null : intersection.intersection_id)}
                className={`bg-white/5 backdrop-blur-lg rounded-lg p-6 border cursor-pointer transition-all duration-300 ${
                  isSelected ? 'border-nvidia green-border-glow scale-105' : 'border-nvidia/20 hover:border-nvidia/40'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-nvidia">
                    {intersection.intersection_id}
                  </h3>
                  <div className={`w-3 h-3 rounded-full ${getPhaseColor(realtimeData.traffic_light_state?.current_phase || '')}`}></div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Queue Length</span>
                    <span className="text-sm font-medium text-white">
                      {(Object.values(realtimeData.queue_lengths || {}) as number[]).reduce((a, b) => a + b, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Wait Time</span>
                    <span className="text-sm font-medium text-white">
                      {realtimeData.average_wait_time}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Active Negotiations</span>
                    <span className="text-sm font-medium text-white">
                      {realtimeData.active_negotiations?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected Intersection Details */}
        {selectedIntersection && (
          <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-lg p-8 border border-nvidia/20 green-border-glow">
            <h2 className="text-2xl font-semibold text-nvidia mb-4">
              {selectedIntersection} - Live View
            </h2>
            
            {(() => {
              const intersection = intersections.find(i => i.intersection_id === selectedIntersection)
              const realtimeData = realtimeUpdates[selectedIntersection] || intersection
              
              if (!realtimeData) return null
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-3">Traffic State</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Phase</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getPhaseColor(realtimeData.traffic_light_state?.current_phase || '')}`}></div>
                          <span className="text-white">{realtimeData.traffic_light_state?.current_phase || 'Unknown'}</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Queue</span>
                        <span className="text-white">
                          {(Object.values(realtimeData.queue_lengths || {}) as number[]).reduce((a, b) => a + b, 0)} vehicles
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Average Wait</span>
                        <span className="text-white">{realtimeData.average_wait_time} seconds</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Throughput</span>
                        <span className="text-white">
                          {Math.floor(60 / (realtimeData.average_wait_time || 1))} vehicles/min
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-white mb-3">Active Negotiations</h3>
                    <div className="space-y-2">
                      {realtimeData.active_negotiations && realtimeData.active_negotiations.length > 0 ? (
                        realtimeData.active_negotiations.map((neg: any, i: number) => (
                          <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-sm text-gray-400">Vehicle {neg.vehicle_id}</span>
                            <span className="text-sm text-nvidia">{neg.priority || 'Normal'}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No active negotiations</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </LayoutWrapper>
  )
}
