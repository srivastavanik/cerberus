import { supabase } from './supabase'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

interface MapboxPlace {
  id: string
  place_name: string
  center: [number, number]
  geometry: {
    type: string
    coordinates: [number, number]
  }
  place_type: string[]
  properties: any
  text: string
  context?: Array<{
    id: string
    text: string
    short_code?: string
  }>
}

interface TrafficIncident {
  id: string
  type: string
  severity: string
  description: string
  location: {
    lat: number
    lng: number
  }
  affected_roads: string[]
  start_time: string
  end_time?: string
}

export class MapboxService {
  private baseUrl = 'https://api.mapbox.com'
  
  constructor(private token: string = MAPBOX_TOKEN!) {
    if (!token) {
      throw new Error('Mapbox token is required')
    }
  }

  // Search for places using Mapbox Geocoding API
  async searchPlaces(query: string, options?: {
    proximity?: [number, number]
    bbox?: [number, number, number, number]
    limit?: number
    types?: string[]
  }): Promise<MapboxPlace[]> {
    const params = new URLSearchParams({
      access_token: this.token,
      limit: (options?.limit || 5).toString()
    })

    if (options?.proximity) {
      params.append('proximity', options.proximity.join(','))
    }
    if (options?.bbox) {
      params.append('bbox', options.bbox.join(','))
    }
    if (options?.types) {
      params.append('types', options.types.join(','))
    }

    const response = await fetch(
      `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
    )

    if (!response.ok) {
      throw new Error(`Mapbox search failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.features || []
  }

  // Get directions between points
  async getDirections(coordinates: [number, number][], profile: 'driving' | 'driving-traffic' = 'driving-traffic'): Promise<{
    routes: Array<{
      distance: number
      duration: number
      duration_typical?: number
      geometry: any
      legs: any[]
    }>
  }> {
    const coords = coordinates.map(c => c.join(',')).join(';')
    
    const params = new URLSearchParams({
      access_token: this.token,
      geometries: 'geojson',
      overview: 'full',
      steps: 'true',
      annotations: 'duration,distance,speed'
    })

    const response = await fetch(
      `${this.baseUrl}/directions/v5/mapbox/${profile}/${coords}?${params}`
    )

    if (!response.ok) {
      throw new Error(`Mapbox directions failed: ${response.statusText}`)
    }

    return response.json()
  }

  // Get traffic incidents in an area
  async getTrafficIncidents(bbox: [number, number, number, number]): Promise<TrafficIncident[]> {
    // Note: Mapbox doesn't have a direct traffic incidents API
    // This would integrate with external traffic data sources
    // For now, we'll query our own system for incidents
    
    const { data } = await supabase
      .from('bottleneck_analysis')
      .select('*')
      .eq('status', 'detected')
      .gte('detected_at', new Date(Date.now() - 3600000).toISOString())

    type BottleneckData = {
      analysis_id: string
      bottleneck_type: string
      severity: number
      root_causes: any
      primary_location: any
      affected_intersections: string[]
      detected_at: string
    }

    const incidents = (data as unknown as BottleneckData[] || [])

    return incidents.map(incident => ({
      id: incident.analysis_id,
      type: incident.bottleneck_type,
      severity: this.mapSeverity(incident.severity),
      description: incident.root_causes?.description || 'Traffic incident',
      location: {
        lat: incident.primary_location?.coordinates?.[1] || 37.7749,
        lng: incident.primary_location?.coordinates?.[0] || -122.4194
      },
      affected_roads: incident.affected_intersections || [],
      start_time: incident.detected_at
    }))
  }

  // Calculate isochrones (areas reachable within a time limit)
  async calculateIsochrone(center: [number, number], minutes: number[], profile: 'driving' | 'driving-traffic' = 'driving-traffic'): Promise<any> {
    const params = new URLSearchParams({
      access_token: this.token,
      contours_minutes: minutes.join(','),
      contours_colors: '6706ce,04e813,4286f4',
      polygons: 'true'
    })

    const response = await fetch(
      `${this.baseUrl}/isochrone/v1/mapbox/${profile}/${center.join(',')}?${params}`
    )

    if (!response.ok) {
      throw new Error(`Mapbox isochrone failed: ${response.statusText}`)
    }

    return response.json()
  }

  // Get real-time traffic data for a route
  async getTrafficData(coordinates: [number, number][]): Promise<{
    congestion_level: number
    average_speed: number
    incidents: TrafficIncident[]
  }> {
    // Get route with traffic data
    const directions = await this.getDirections(coordinates)
    
    if (!directions.routes.length) {
      return {
        congestion_level: 0,
        average_speed: 25,
        incidents: []
      }
    }

    const route = directions.routes[0]
    const typicalDuration = route.duration_typical || route.duration
    const currentDuration = route.duration
    
    // Calculate congestion based on duration difference
    const congestionRatio = currentDuration / typicalDuration
    const congestionLevel = Math.min(10, Math.max(0, (congestionRatio - 1) * 10))
    
    // Calculate average speed
    const distanceKm = route.distance / 1000
    const durationHours = currentDuration / 3600
    const averageSpeed = distanceKm / durationHours

    // Get incidents along the route
    const routeBounds = this.getRouteBounds(route.geometry.coordinates)
    const incidents = await this.getTrafficIncidents(routeBounds)

    return {
      congestion_level: Math.round(congestionLevel),
      average_speed: Math.round(averageSpeed),
      incidents
    }
  }

  // Helper to calculate bounds from route coordinates
  private getRouteBounds(coordinates: [number, number][]): [number, number, number, number] {
    let minLng = Infinity, minLat = Infinity
    let maxLng = -Infinity, maxLat = -Infinity

    coordinates.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    })

    return [minLng, minLat, maxLng, maxLat]
  }

  private mapSeverity(severity: number): string {
    if (severity <= 3) return 'low'
    if (severity <= 6) return 'moderate'
    if (severity <= 8) return 'major'
    return 'severe'
  }

  // Find optimal pickup/dropoff points
  async findOptimalPickupPoints(origin: [number, number], destination: [number, number]): Promise<{
    pickup: [number, number]
    dropoff: [number, number]
    walking_time_pickup: number
    walking_time_dropoff: number
  }> {
    // Search for nearby road access points
    const pickupSearch = await this.searchPlaces('street', {
      proximity: origin,
      limit: 3,
      types: ['address']
    })

    const dropoffSearch = await this.searchPlaces('street', {
      proximity: destination,
      limit: 3,
      types: ['address']
    })

    // Default to original points if no better options found
    const pickup = pickupSearch[0]?.center || origin
    const dropoff = dropoffSearch[0]?.center || destination

    // Estimate walking times (assuming 5 km/h walking speed)
    const walkingSpeed = 5 / 60 // km per minute
    const pickupDistance = this.haversineDistance(origin, pickup)
    const dropoffDistance = this.haversineDistance(destination, dropoff)

    return {
      pickup,
      dropoff,
      walking_time_pickup: Math.round(pickupDistance / walkingSpeed),
      walking_time_dropoff: Math.round(dropoffDistance / walkingSpeed)
    }
  }

  // Calculate distance between two points
  private haversineDistance(point1: [number, number], point2: [number, number]): number {
    const R = 6371 // Earth's radius in km
    const lat1 = point1[1] * Math.PI / 180
    const lat2 = point2[1] * Math.PI / 180
    const deltaLat = (point2[1] - point1[1]) * Math.PI / 180
    const deltaLng = (point2[0] - point1[0]) * Math.PI / 180

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }
}

// Export singleton instance
export const mapboxService = new MapboxService()
