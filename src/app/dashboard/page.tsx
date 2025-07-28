'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LayoutWrapper from '../../components/layout-wrapper'
import type { SystemMetrics, VehicleState, IntersectionState } from '../../lib/supabase'

export default function Dashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [vehicleCount, setVehicleCount] = useState(0)
  const [activeIntersections, setActiveIntersections] = useState(0)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    fetchData()
    
    const metricsSubscription = supabase
      .channel('dashboard-metrics')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'system_metrics'
      }, (payload) => {
        const newMetrics = payload.new as SystemMetrics
        setMetrics(newMetrics)
      })
      .subscribe()

    const interval = setInterval(fetchData, 30000)

    return () => {
      metricsSubscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const fetchData = async () => {
    // Fetch latest metrics
    const { data: metricsData } = await supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (metricsData) {
      setMetrics(metricsData as unknown as SystemMetrics)
    }

    // Get vehicle count
    const { count } = await supabase
      .from('vehicle_states')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', new Date(Date.now() - 120000).toISOString())

    setVehicleCount(count || 0)

    // Get active intersections
    const { data: intersections } = await supabase
      .from('intersection_states')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())

    const typedIntersections = intersections as IntersectionState[] | null
    const active = typedIntersections?.filter(i => 
      i.active_negotiations && Array.isArray(i.active_negotiations) && i.active_negotiations.length > 0
    ).length || 0
    setActiveIntersections(active)

    // Get recent coordination events
    const { data: events } = await supabase
      .from('coordination_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10)

    setRecentActivity(events || [])
  }

  return (
    <LayoutWrapper>
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-nvidia mb-8">System Dashboard</h1>
        
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow">
            <div className="text-3xl font-bold text-nvidia mb-2">{vehicleCount}</div>
            <div className="text-sm text-gray-400">Active Vehicles</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow">
            <div className="text-3xl font-bold text-nvidia mb-2">{activeIntersections}</div>
            <div className="text-sm text-gray-400">Active Negotiations</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow">
            <div className="text-3xl font-bold text-nvidia mb-2">
              {metrics ? `${(metrics.average_wait_reduction * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-sm text-gray-400">Wait Time Reduction</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow">
            <div className="text-3xl font-bold text-nvidia mb-2">
              {metrics ? `${(metrics.fairness_score * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-sm text-gray-400">Fairness Score</div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow">
          <h2 className="text-2xl font-semibold text-white mb-4">Recent Coordination Events</h2>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((event, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-nvidia/10">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-nvidia rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-300">{event.event_type}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {event.details?.intersection || event.details?.district || 'System-wide'}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent events</p>
            )}
          </div>
        </div>

        {/* System Performance */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20">
              <h3 className="text-lg font-semibold text-nvidia mb-4">Coordination Rate</h3>
              <div className="text-4xl font-bold text-white">{metrics.coordinations_per_minute}</div>
              <div className="text-sm text-gray-400 mt-1">per minute</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20">
              <h3 className="text-lg font-semibold text-nvidia mb-4">Total Vehicles</h3>
              <div className="text-4xl font-bold text-white">{metrics.total_vehicles}</div>
              <div className="text-sm text-gray-400 mt-1">in system</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20">
              <h3 className="text-lg font-semibold text-nvidia mb-4">Avg Wait Time</h3>
              <div className="text-4xl font-bold text-white">{(metrics.average_wait_reduction * 100).toFixed(0)}%</div>
              <div className="text-sm text-gray-400 mt-1">reduction</div>
            </div>
          </div>
        )}
      </div>
    </LayoutWrapper>
  )
}
