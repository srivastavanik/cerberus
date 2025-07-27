'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import LayoutWrapper from '../../components/layout-wrapper'
import type { DistrictMetrics } from '../../lib/supabase'

const DISTRICTS = [
  'soma', 'mission', 'castro', 'richmond', 'sunset', 'marina',
  'pacific_heights', 'chinatown', 'north_beach', 'financial_district',
  'tenderloin', 'presidio'
]

export default function Districts() {
  const [districtData, setDistrictData] = useState<Record<string, DistrictMetrics>>({})
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)

  useEffect(() => {
    fetchDistrictData()
    
    const subscription = supabase
      .channel('district-metrics')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'district_metrics'
      }, (payload) => {
        const newMetrics = payload.new as DistrictMetrics
        setDistrictData(prev => ({
          ...prev,
          [newMetrics.district]: newMetrics
        }))
      })
      .subscribe()

    const interval = setInterval(fetchDistrictData, 30000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const fetchDistrictData = async () => {
    const { data } = await supabase
      .from('district_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString())
      .order('timestamp', { ascending: false })

    if (data) {
      const latestByDistrict: Record<string, DistrictMetrics> = {}
      data.forEach(metric => {
        if (!latestByDistrict[metric.district] || 
            new Date(metric.timestamp) > new Date(latestByDistrict[metric.district].timestamp)) {
          latestByDistrict[metric.district] = metric
        }
      })
      setDistrictData(latestByDistrict)
    }
  }

  const getDistrictColor = (congestion: number) => {
    if (congestion < 0.3) return 'text-green-500'
    if (congestion < 0.6) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <LayoutWrapper>
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-nvidia mb-8">District Overview</h1>
        
        {/* District Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {DISTRICTS.map(district => {
            const data = districtData[district]
            const isSelected = selectedDistrict === district
            
            return (
              <div
                key={district}
                onClick={() => setSelectedDistrict(isSelected ? null : district)}
                className={`bg-white/5 backdrop-blur-lg rounded-lg p-6 border cursor-pointer transition-all duration-300 ${
                  isSelected ? 'border-nvidia green-border-glow scale-105' : 'border-nvidia/20 hover:border-nvidia/40'
                }`}
              >
                <h3 className="text-lg font-semibold text-nvidia mb-3 capitalize">
                  {district.replace('_', ' ')}
                </h3>
                
                {data ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Vehicles</span>
                      <span className="text-sm font-medium text-white">{data.vehicle_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Congestion</span>
                      <span className={`text-sm font-medium ${getDistrictColor(data.congestion_level)}`}>
                        {(data.congestion_level * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Wait Time</span>
                      <span className="text-sm font-medium text-white">{data.average_wait_time}s</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No data</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Selected District Details */}
        {selectedDistrict && districtData[selectedDistrict] && (
          <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-lg p-8 border border-nvidia/20 green-border-glow">
            <h2 className="text-2xl font-semibold text-nvidia mb-4 capitalize">
              {selectedDistrict.replace('_', ' ')} - Detailed View
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-3">Traffic Metrics</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Vehicles</span>
                    <span className="text-white">{districtData[selectedDistrict].vehicle_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Congestion Level</span>
                    <span className={getDistrictColor(districtData[selectedDistrict].congestion_level)}>
                      {(districtData[selectedDistrict].congestion_level * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Average Wait Time</span>
                    <span className="text-white">{districtData[selectedDistrict].average_wait_time} seconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coordination Score</span>
                    <span className="text-nvidia">
                      {(districtData[selectedDistrict].coordination_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-3">System Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Active Negotiations</span>
                    <span className="text-white">
                      {districtData[selectedDistrict].active_negotiations || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Update</span>
                    <span className="text-white">
                      {new Date(districtData[selectedDistrict].timestamp).toLocaleTimeString()}
                    </span>
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
