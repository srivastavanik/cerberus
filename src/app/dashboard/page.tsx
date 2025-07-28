'use client'

import { useEffect, useState } from 'react'
import { mockSupabase } from '../../lib/mock-data'
import LayoutWrapper from '../../components/layout-wrapper'
import MapboxMap from '../../components/mapbox-map'
import type { MockSystemMetrics, MockVehicleState, MockIntersectionState } from '../../lib/mock-data'

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MockSystemMetrics | null>(null)
  const [vehicleCount, setVehicleCount] = useState(0)
  const [activeIntersections, setActiveIntersections] = useState(0)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [intersections, setIntersections] = useState<any[]>([])

  useEffect(() => {
    fetchData()
    
    // Update data every 3 seconds for real-time feel with mock data
    const interval = setInterval(fetchData, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const fetchData = async () => {
    try {
      // Fetch latest metrics
      const { data: metricsData } = await mockSupabase
        .from('system_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single()

      if (metricsData) {
        setMetrics(metricsData)
      }

      // Get vehicle count
      const { count } = await mockSupabase
        .from('vehicle_states')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', new Date(Date.now() - 120000).toISOString())

      setVehicleCount(count || 0)

      // Get active intersections
      const { data: intersectionData } = await mockSupabase
        .from('intersection_states')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 60000).toISOString())

      const active = intersectionData?.filter((i: any) => 
        i.active_negotiations && i.active_negotiations.length > 0
      ).length || 0
      setActiveIntersections(active)

      // Get recent coordination events
      const { data: events } = await mockSupabase
        .from('coordination_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10)

      setRecentActivity(events || [])

      // Fetch vehicles for map
      const { data: vehicleData } = await mockSupabase
        .from('vehicle_states')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
        .order('timestamp', { ascending: false })

      // Group by vehicle_id and get latest position for each
      const latestVehicles = vehicleData?.reduce((acc: any[], vehicle: any) => {
        const existing = acc.find(v => v.vehicle_id === vehicle.vehicle_id)
        if (!existing) {
          acc.push({
            id: vehicle.vehicle_id,
            lat: vehicle.latitude,
            lng: vehicle.longitude,
            status: vehicle.status,
            fleet: vehicle.fleet || vehicle.company || 'unknown'
          })
        }
        return acc
      }, []) || []

      setVehicles(latestVehicles)

      // Fetch intersections for map
      const { data: intersections } = await mockSupabase
        .from('intersection_states')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
        .order('timestamp', { ascending: false })

      // Group by intersection_id and get latest state for each
      const latestIntersections = intersections?.reduce((acc: any[], intersection: any) => {
        const existing = acc.find(i => i.intersection_id === intersection.intersection_id)
        if (!existing) {
          acc.push({
            id: intersection.intersection_id,
            lat: intersection.latitude,
            lng: intersection.longitude,
            active_negotiations: intersection.active_negotiations
          })
        }
        return acc
      }, []) || []

      setIntersections(latestIntersections)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  return (
    <LayoutWrapper>
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-nvidia mb-8">System Dashboard</h1>
        
        {/* Live Map */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Live System Overview</h2>
          <div className="h-96 rounded-lg overflow-hidden">
            <MapboxMap vehicles={vehicles} intersections={intersections} />
          </div>
          <div className="flex justify-center mt-4 space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-300">Waymo</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-300">Cruise</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-teal-400"></div>
              <span className="text-gray-300">Zoox</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-gray-300">Active Intersections</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-teal-400"></div>
              <span className="text-gray-300">Clear Intersections</span>
            </div>
          </div>
        </div>

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
