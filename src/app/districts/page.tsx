'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import LayoutWrapper from '../../components/layout-wrapper'
import type { DistrictMetrics, VehicleState } from '../../lib/supabase'

// Dynamically import Mapbox to avoid SSR issues
const MapboxMap = dynamic(() => import('../../components/mapbox-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-900 animate-pulse rounded-lg" />
})

const DISTRICTS = [
  'soma', 'mission', 'castro', 'richmond', 'sunset', 'marina',
  'pacific_heights', 'chinatown', 'north_beach', 'financial_district',
  'tenderloin', 'presidio'
]

export default function Districts() {
  const [districtData, setDistrictData] = useState<Record<string, DistrictMetrics>>({})
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [vehicleMarkers, setVehicleMarkers] = useState<Array<{
    id: string
    position: [number, number]
    color?: string
    popup?: string
  }>>([])

  useEffect(() => {
    fetchDistrictData()
    fetchVehicleData()
    
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
          [newMetrics.district_name]: newMetrics
        }))
      })
      .subscribe()

    // Subscribe to vehicle state changes
    const vehicleSubscription = supabase
      .channel('vehicle-states')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vehicle_states'
      }, () => {
        fetchVehicleData()
      })
      .subscribe()

    const interval = setInterval(() => {
      fetchDistrictData()
      fetchVehicleData()
    }, 5000)

    return () => {
      subscription.unsubscribe()
      vehicleSubscription.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const fetchVehicleData = async () => {
    const { data } = await supabase
      .from('vehicle_states')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())

    if (data) {
      const vehicles = data as unknown as VehicleState[]
      const markers = vehicles.map(vehicle => {
        const coordinates = vehicle.grid_position?.coordinates || [-122.4194, 37.7749]
        return {
          id: vehicle.vehicle_id,
          position: [coordinates[0], coordinates[1]] as [number, number],
          color: vehicle.company === 'waymo' ? '#4285F4' : 
                 vehicle.company === 'zoox' ? '#00A86B' : '#FF6F00',
          popup: `${vehicle.company.toUpperCase()} - ${vehicle.status}`
        }
      })
      setVehicleMarkers(markers)
    }
  }

  const fetchDistrictData = async () => {
    const { data } = await supabase
      .from('district_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString())
      .order('timestamp', { ascending: false })

    if (data) {
      const latestByDistrict: Record<string, DistrictMetrics> = {}
      const metrics = data as unknown as DistrictMetrics[]
      metrics.forEach((metric) => {
        if (!latestByDistrict[metric.district_name] || 
            new Date(metric.timestamp) > new Date(latestByDistrict[metric.district_name].timestamp)) {
          latestByDistrict[metric.district_name] = metric
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
                      <span className="text-sm text-gray-400">Vehicle Density</span>
                      <span className="text-sm font-medium text-white">{data.vehicle_density}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Congestion</span>
                      <span className={`text-sm font-medium ${getDistrictColor(data.congestion_level)}`}>
                        {(data.congestion_level * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Avg Speed</span>
                      <span className="text-sm font-medium text-white">{data.average_speed.toFixed(1)} mph</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No data</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Map View */}
        <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-nvidia/20">
          <h2 className="text-2xl font-semibold text-nvidia mb-4">Live Vehicle Map</h2>
          <div className="h-[500px] rounded-lg overflow-hidden">
            <MapboxMap
              center={[-122.4194, 37.7749]}
              zoom={12}
              markers={vehicleMarkers}
            />
          </div>
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
                    <span className="text-gray-400">Vehicle Density</span>
                    <span className="text-white">{districtData[selectedDistrict].vehicle_density}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Congestion Level</span>
                    <span className={getDistrictColor(districtData[selectedDistrict].congestion_level)}>
                      {(districtData[selectedDistrict].congestion_level * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Average Speed</span>
                    <span className="text-white">{districtData[selectedDistrict].average_speed.toFixed(1)} mph</span>
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
                    <span className="text-gray-400">Active Intersections</span>
                    <span className="text-white">
                      {districtData[selectedDistrict].active_intersections || 0}
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
