'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LayoutWrapper from '../../components/layout-wrapper'
import type { SystemMetrics, DistrictMetrics, FleetStatistics } from '../../lib/supabase'

export default function Metrics() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([])
  const [districtMetrics, setDistrictMetrics] = useState<DistrictMetrics[]>([])
  const [fleetMetrics, setFleetMetrics] = useState<FleetStatistics[]>([])
  const [timeRange, setTimeRange] = useState('1h')

  useEffect(() => {
    fetchMetrics()
    
    const subscription = supabase
      .channel('all-metrics')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'system_metrics'
      }, fetchMetrics)
      .subscribe()

    const interval = setInterval(fetchMetrics, 30000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [timeRange])

  const fetchMetrics = async () => {
    const timeAgo = timeRange === '1h' ? 3600000 : timeRange === '24h' ? 86400000 : 604800000
    const since = new Date(Date.now() - timeAgo).toISOString()

    // System metrics
    const { data: sysData } = await supabase
      .from('system_metrics')
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(100)
      .returns<SystemMetrics[]>()

    if (sysData) setSystemMetrics(sysData)

    // District metrics
    const { data: distData } = await supabase
      .from('district_metrics')
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(200)
      .returns<DistrictMetrics[]>()

    if (distData) setDistrictMetrics(distData)

    // Fleet metrics
    const { data: fleetData } = await supabase
      .from('fleet_statistics')
      .select('*')
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(200)
      .returns<FleetStatistics[]>()

    if (fleetData) setFleetMetrics(fleetData)
  }

  const getLatestSystemMetrics = () => systemMetrics[0] || null

  const getAverageMetric = (arr: any[], key: string) => {
    if (arr.length === 0) return 0
    const sum = arr.reduce((acc, item) => acc + (item[key] || 0), 0)
    return sum / arr.length
  }

  return (
    <LayoutWrapper>
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-nvidia">System Metrics</h1>
          
          {/* Time Range Selector */}
          <div className="flex space-x-2">
            {['1h', '24h', '7d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                  timeRange === range
                    ? 'bg-nvidia text-black font-semibold'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
              >
                {range === '1h' ? '1 Hour' : range === '24h' ? '24 Hours' : '7 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Current System Status */}
        {getLatestSystemMetrics() && (
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 green-border-glow mb-8">
            <h2 className="text-2xl font-semibold text-white mb-4">Current System Status</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-3xl font-bold text-nvidia">
                  {getLatestSystemMetrics()!.total_vehicles}
                </div>
                <div className="text-sm text-gray-400">Total Vehicles</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-nvidia">
                  {getLatestSystemMetrics()!.coordinations_per_minute}
                </div>
                <div className="text-sm text-gray-400">Coordinations/min</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-nvidia">
                  {(getLatestSystemMetrics()!.average_wait_reduction * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">Wait Reduction</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-nvidia">
                  {(getLatestSystemMetrics()!.fairness_score * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">Fairness Score</div>
              </div>
            </div>
          </div>
        )}

        {/* System Performance Over Time */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Performance Trends</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-medium text-nvidia mb-3">Average Wait Reduction</h3>
              <div className="text-4xl font-bold text-white">
                {(getAverageMetric(systemMetrics, 'average_wait_reduction') * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400 mt-1">avg over {timeRange}</div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-nvidia mb-3">Coordination Rate</h3>
              <div className="text-4xl font-bold text-white">
                {getAverageMetric(systemMetrics, 'coordinations_per_minute').toFixed(1)}
              </div>
              <div className="text-sm text-gray-400 mt-1">per minute avg</div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-nvidia mb-3">System Fairness</h3>
              <div className="text-4xl font-bold text-white">
                {(getAverageMetric(systemMetrics, 'fairness_score') * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-400 mt-1">fairness index</div>
            </div>
          </div>
        </div>

        {/* District Performance Summary */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">District Performance</h2>
          
          <div className="space-y-3">
            {Array.from(new Set(districtMetrics.map(d => d.district_name))).slice(0, 6).map(district => {
              const districtData = districtMetrics.filter(d => d.district_name === district)
              const avgCongestion = getAverageMetric(districtData, 'congestion_level')
              const avgSpeed = getAverageMetric(districtData, 'average_speed')
              
              return (
                <div key={district} className="flex items-center justify-between py-2 border-b border-nvidia/10">
                  <span className="text-sm font-medium text-gray-300 capitalize">
                    {district.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-6">
                    <span className="text-sm text-gray-400">
                      Congestion: <span className="text-white">{avgCongestion.toFixed(0)}/10</span>
                    </span>
                    <span className="text-sm text-gray-400">
                      Speed: <span className="text-white">{avgSpeed.toFixed(0)} mph</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Fleet Efficiency Comparison */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20">
          <h2 className="text-2xl font-semibold text-white mb-4">Fleet Efficiency</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['waymo', 'zoox', 'cruise'].map(company => {
              const companyData = fleetMetrics.filter(f => f.company === company)
              const avgUtilization = companyData.length > 0 
                ? (getAverageMetric(companyData, 'active_vehicles') / 
                   (getAverageMetric(companyData, 'active_vehicles') + getAverageMetric(companyData, 'idle_vehicles'))) * 100
                : 0
              
              return (
                <div key={company} className="text-center">
                  <h3 className="text-lg font-medium text-nvidia mb-3 capitalize">{company}</h3>
                  <div className="text-3xl font-bold text-white mb-1">
                    {avgUtilization.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-400">utilization</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </LayoutWrapper>
  )
}
