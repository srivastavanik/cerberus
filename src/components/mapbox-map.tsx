'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Initialize Mapbox token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface MapboxMapProps {
  center?: [number, number]
  zoom?: number
  markers?: Array<{
    id: string
    position: [number, number]
    color?: string
    popup?: string
  }>
  style?: string
  className?: string
  onLoad?: (map: mapboxgl.Map) => void
}

export default function MapboxMap({
  center = [-122.4194, 37.7749], // San Francisco center
  zoom = 12,
  markers = [],
  style = 'mapbox://styles/mapbox/dark-v11',
  className = '',
  onLoad
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({})

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    try {
      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: style,
        center: center,
        zoom: zoom,
        pitch: 45,
        bearing: -17.6,
        antialias: true
      })

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Add 3D buildings layer
      map.current.on('load', () => {
        if (!map.current) return

        // Add 3D buildings
        const layers = map.current.getStyle().layers
        const labelLayerId = layers?.find(
          (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
        )?.id

        map.current.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
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
          },
          labelLayerId
        )

        setMapLoaded(true)
        if (onLoad && map.current) {
          onLoad(map.current)
        }
      })
    } catch (error) {
      console.error('Error initializing map:', error)
    }

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Handle markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove old markers
    Object.values(markersRef.current).forEach(marker => marker.remove())
    markersRef.current = {}

    // Add new markers
    markers.forEach(markerData => {
      const el = document.createElement('div')
      el.className = 'custom-marker'
      el.style.backgroundColor = markerData.color || '#76B900'
      el.style.width = '20px'
      el.style.height = '20px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid white'
      el.style.cursor = 'pointer'
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

      const marker = new mapboxgl.Marker(el)
        .setLngLat(markerData.position)
        .addTo(map.current!)

      if (markerData.popup) {
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setText(markerData.popup)
        marker.setPopup(popup)
      }

      markersRef.current[markerData.id] = marker
    })
  }, [markers, mapLoaded])

  return (
    <div 
      ref={mapContainer} 
      className={`w-full h-full ${className}`}
      style={{ minHeight: '400px' }}
    />
  )
}
