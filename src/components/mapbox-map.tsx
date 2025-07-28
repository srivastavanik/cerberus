'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface MapboxMapProps {
  vehicles?: Array<{
    id: string
    lat: number
    lng: number
    status: string
    fleet: string
  }>
  intersections?: Array<{
    id: string
    lat: number
    lng: number
    active_negotiations?: any[]
  }>
  className?: string
}

export default function MapboxMap({ vehicles = [], intersections = [], className = '' }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainer.current) return

    // Initialize map
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-122.4194, 37.7749], // San Francisco center
      zoom: 12,
      pitch: 45,
      bearing: 0
    })

    map.current.on('load', () => {
      setMapLoaded(true)
      
      // Add 3D buildings layer
      if (map.current) {
        map.current.addLayer({
          'id': '3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'height']
            ],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15,
              0,
              15.05,
              ['get', 'min_height']
            ],
            'fill-extrusion-opacity': 0.6
          }
        })
      }
    })

    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [])

  // Update vehicle markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing vehicle markers
    const existingVehicleMarkers = document.querySelectorAll('.vehicle-marker')
    existingVehicleMarkers.forEach(marker => marker.remove())

    // Add vehicle markers
    vehicles.forEach(vehicle => {
      // Validate coordinates
      if (isNaN(vehicle.lat) || isNaN(vehicle.lng) || 
          vehicle.lat === null || vehicle.lng === null ||
          vehicle.lat === undefined || vehicle.lng === undefined) {
        console.warn(`Invalid coordinates for vehicle ${vehicle.id}:`, vehicle.lat, vehicle.lng)
        return
      }

      const el = document.createElement('div')
      el.className = 'vehicle-marker'
      el.style.width = '12px'
      el.style.height = '12px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid #76b900'
      el.style.backgroundColor = getVehicleColor(vehicle.fleet, vehicle.status)
      el.style.boxShadow = '0 0 10px rgba(118, 185, 0, 0.6)'
      el.style.cursor = 'pointer'

      // Add popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <div class="font-semibold text-sm">Vehicle ${vehicle.id}</div>
          <div class="text-xs text-gray-600">Fleet: ${vehicle.fleet}</div>
          <div class="text-xs text-gray-600">Status: ${vehicle.status}</div>
        </div>
      `)

      new mapboxgl.Marker(el)
        .setLngLat([vehicle.lng, vehicle.lat])
        .setPopup(popup)
        .addTo(map.current!)
    })
  }, [vehicles, mapLoaded])

  // Update intersection markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing intersection markers
    const existingIntersectionMarkers = document.querySelectorAll('.intersection-marker')
    existingIntersectionMarkers.forEach(marker => marker.remove())

    // Add intersection markers
    intersections.forEach(intersection => {
      // Validate coordinates
      if (isNaN(intersection.lat) || isNaN(intersection.lng) || 
          intersection.lat === null || intersection.lng === null ||
          intersection.lat === undefined || intersection.lng === undefined) {
        console.warn(`Invalid coordinates for intersection ${intersection.id}:`, intersection.lat, intersection.lng)
        return
      }

      const hasActiveNegotiations = intersection.active_negotiations && intersection.active_negotiations.length > 0
      
      const el = document.createElement('div')
      el.className = 'intersection-marker'
      el.style.width = '16px'
      el.style.height = '16px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid #ffffff'
      el.style.backgroundColor = hasActiveNegotiations ? '#ff6b6b' : '#4ecdc4'
      el.style.boxShadow = `0 0 15px ${hasActiveNegotiations ? 'rgba(255, 107, 107, 0.8)' : 'rgba(78, 205, 196, 0.6)'}`
      el.style.cursor = 'pointer'
      
      if (hasActiveNegotiations) {
        el.style.animation = 'pulse 2s infinite'
      }

      // Add popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <div class="font-semibold text-sm">Intersection ${intersection.id}</div>
          <div class="text-xs text-gray-600">
            Active Negotiations: ${intersection.active_negotiations?.length || 0}
          </div>
          ${hasActiveNegotiations ? '<div class="text-xs text-red-500">🔴 Active</div>' : '<div class="text-xs text-green-500">🟢 Clear</div>'}
        </div>
      `)

      new mapboxgl.Marker(el)
        .setLngLat([intersection.lng, intersection.lat])
        .setPopup(popup)
        .addTo(map.current!)
    })
  }, [intersections, mapLoaded])

  const getVehicleColor = (fleet: string, status: string): string => {
    const fleetColors: { [key: string]: string } = {
      'waymo': '#4285f4',
      'cruise': '#ff6b6b',
      'zoox': '#4ecdc4',
      'default': '#76b900'
    }

    const baseColor = fleetColors[fleet.toLowerCase()] || fleetColors.default
    
    // Modify opacity based on status
    if (status === 'idle') {
      return baseColor + '80' // 50% opacity
    }
    
    return baseColor
  }

  return (
    <>
      <div 
        ref={mapContainer} 
        className={`w-full h-full ${className}`}
        style={{ minHeight: '400px' }}
      />
      <style jsx global>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.8);
          }
          50% {
            box-shadow: 0 0 25px rgba(255, 107, 107, 1);
          }
          100% {
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.8);
          }
        }
      `}</style>
    </>
  )
}
