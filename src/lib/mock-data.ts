import { v4 as uuidv4 } from 'uuid'

// Mock data interfaces matching the Supabase types
export interface MockVehicleState {
  id: string
  vehicle_id: string
  company: 'waymo' | 'zoox' | 'cruise'
  timestamp: string
  latitude: number
  longitude: number
  status: 'idle' | 'pickup' | 'enroute' | 'charging' | 'emergency_yield'
  anonymized_data: Record<string, any>
  battery_level?: number
  passenger_count?: number
  fleet?: string
}

export interface MockIntersectionState {
  id: string
  intersection_id: string
  timestamp: string
  latitude: number
  longitude: number
  queue_lengths: Record<string, number>
  average_wait_time: number
  active_negotiations: any[]
  traffic_light_state?: Record<string, any>
}

export interface MockSystemMetrics {
  id: string
  timestamp: string
  total_vehicles: number
  coordinations_per_minute: number
  average_wait_reduction: number
  fairness_score: number
  emergency_response_time?: number
  district_congestion_levels: Record<string, number>
}

export interface MockCoordinationEvent {
  id: string
  timestamp: string
  event_type: 'intersection_negotiation' | 'emergency_corridor' | 'fleet_rebalancing' | 'congestion_mitigation' | 'special_event'
  participants: string[]
  outcome: Record<string, any>
  metrics: {
    wait_time_saved?: number
    efficiency_score?: number
    vehicles_coordinated?: number
  }
  details?: Record<string, any>
}

export interface MockCoordinationMessage {
  id: string
  msg_id: string
  timestamp: string
  sender: string
  recipient: string
  message_type: 'proposal' | 'acceptance' | 'rejection' | 'info' | 'emergency'
  priority: number
  payload: Record<string, any>
  ttl: number
  status: 'pending' | 'delivered' | 'expired'
}

export interface MockFleetStatistics {
  id: string
  company: 'waymo' | 'zoox' | 'cruise'
  timestamp: string
  active_vehicles: number
  idle_vehicles: number
  passenger_miles: number
  average_wait_time: number
  priority_score: number
}

export interface MockDistrictMetrics {
  id: string
  district: string
  timestamp: string
  vehicle_count: number
  congestion_level: number
  average_wait_time: number
  coordination_score: number
  active_negotiations?: number
}

export interface MockIntersectionMetrics {
  id: string
  intersection_id: string
  timestamp: string
  current_phase?: string
  traffic_level: 'low' | 'medium' | 'high'
  throughput: number
  average_wait_time: number
  active_negotiations?: any[]
}

// SF Districts
const SF_DISTRICTS = [
  'financial', 'soma', 'mission', 'castro', 'haight', 'richmond', 
  'sunset', 'marina', 'northbeach', 'chinatown', 'tenderloin', 'nobhill'
]

// SF Coordinates (approximate boundaries)
const SF_BOUNDS = {
  north: 37.8199,
  south: 37.7049,
  east: -122.3482,
  west: -122.5108
}

// Generate realistic SF coordinates
function generateSFCoordinates() {
  const lat = SF_BOUNDS.south + Math.random() * (SF_BOUNDS.north - SF_BOUNDS.south)
  const lng = SF_BOUNDS.west + Math.random() * (SF_BOUNDS.east - SF_BOUNDS.west)
  return { lat, lng }
}

// Generate random district
function getRandomDistrict() {
  return SF_DISTRICTS[Math.floor(Math.random() * SF_DISTRICTS.length)]
}

// Query builder that returns a proper promise
class MockQueryBuilder {
  constructor(
    private store: MockDataStore,
    private table: string,
    private columns: string = '*',
    private filters: any = {},
    private options: any = {}
  ) {}

  eq(column: string, value: any): MockQueryBuilder {
    return new MockQueryBuilder(this.store, this.table, this.columns, 
      { ...this.filters, [column]: value }, this.options)
  }

  gte(column: string, value: any): MockQueryBuilder {
    return new MockQueryBuilder(this.store, this.table, this.columns, 
      { ...this.filters, [`${column}_gte`]: value }, this.options)
  }

  lte(column: string, value: any): MockQueryBuilder {
    return new MockQueryBuilder(this.store, this.table, this.columns, 
      { ...this.filters, [`${column}_lte`]: value }, this.options)
  }

  order(column: string, orderOptions: any): MockQueryBuilder {
    return new MockQueryBuilder(this.store, this.table, this.columns, this.filters, 
      { ...this.options, orderBy: column, ascending: orderOptions.ascending })
  }

  limit(count: number): MockQueryBuilder {
    return new MockQueryBuilder(this.store, this.table, this.columns, this.filters, 
      { ...this.options, limit: count })
  }

  single(): MockQueryBuilder {
    return new MockQueryBuilder(this.store, this.table, this.columns, this.filters, 
      { ...this.options, single: true })
  }

  // Make this thenable/awaitable
  then(onFulfilled?: any, onRejected?: any): Promise<any> {
    const result = this.store.query(this.table, this.columns, this.filters, this.options)
    return Promise.resolve(result).then(onFulfilled, onRejected)
  }

  catch(onRejected: any): Promise<any> {
    const result = this.store.query(this.table, this.columns, this.filters, this.options)
    return Promise.resolve(result).catch(onRejected)
  }
}

// Mock data store
class MockDataStore {
  private vehicles: MockVehicleState[] = []
  private intersections: MockIntersectionState[] = []
  private systemMetrics: MockSystemMetrics[] = []
  private coordinationEvents: MockCoordinationEvent[] = []
  private coordinationMessages: MockCoordinationMessage[] = []
  private fleetStatistics: MockFleetStatistics[] = []
  private districtMetrics: MockDistrictMetrics[] = []
  private intersectionMetrics: MockIntersectionMetrics[] = []
  private subscribers: Map<string, Function[]> = new Map()

  constructor() {
    this.initializeData()
    this.startDataGeneration()
  }

  private initializeData() {
    // Generate initial vehicles (150 total across fleets)
    const fleets = [
      { name: 'waymo', count: 60, color: 'blue' },
      { name: 'cruise', count: 50, color: 'red' },
      { name: 'zoox', count: 40, color: 'teal' }
    ]

    fleets.forEach(fleet => {
      for (let i = 0; i < fleet.count; i++) {
        const coords = generateSFCoordinates()
        const district = getRandomDistrict()
        
        this.vehicles.push({
          id: uuidv4(),
          vehicle_id: `${fleet.name.toUpperCase().slice(0, 2)}${(i + 1).toString().padStart(3, '0')}`,
          company: fleet.name as 'waymo' | 'zoox' | 'cruise',
          timestamp: new Date().toISOString(),
          latitude: coords.lat,
          longitude: coords.lng,
          status: Math.random() > 0.3 ? 'enroute' : (Math.random() > 0.5 ? 'pickup' : 'idle'),
          fleet: fleet.name,
          battery_level: Math.floor(Math.random() * 40) + 60, // 60-100%
          passenger_count: Math.random() > 0.6 ? Math.floor(Math.random() * 4) + 1 : 0,
          anonymized_data: {
            district,
            wait_time: Math.random() * 15 + 2, // 2-17 seconds
            trip_efficiency: Math.random() * 0.3 + 0.7, // 70-100%
            last_coordination: new Date(Date.now() - Math.random() * 300000).toISOString()
          }
        })
      }
    })

    // Generate intersections (50 major intersections in SF)
    for (let i = 0; i < 50; i++) {
      const coords = generateSFCoordinates()
      const hasNegotiations = Math.random() > 0.7
      const negotiations = hasNegotiations ? 
        Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => ({
          vehicle_id: this.vehicles[Math.floor(Math.random() * this.vehicles.length)].vehicle_id,
          priority: Math.floor(Math.random() * 10) + 1,
          eta: Math.random() * 30 + 5
        })) : []

      this.intersections.push({
        id: uuidv4(),
        intersection_id: `INT${(i + 1).toString().padStart(3, '0')}`,
        timestamp: new Date().toISOString(),
        latitude: coords.lat,
        longitude: coords.lng,
        queue_lengths: {
          north: Math.floor(Math.random() * 8),
          south: Math.floor(Math.random() * 8),
          east: Math.floor(Math.random() * 8),
          west: Math.floor(Math.random() * 8)
        },
        average_wait_time: Math.random() * 25 + 5, // 5-30 seconds
        active_negotiations: negotiations,
        traffic_light_state: {
          current_phase: ['green_ns', 'yellow_ns', 'red_ns', 'green_ew', 'yellow_ew', 'red_ew'][Math.floor(Math.random() * 6)],
          time_remaining: Math.floor(Math.random() * 45) + 15
        }
      })
    }

    // Generate initial metrics
    this.generateSystemMetrics()
    this.generateFleetStatistics()
    this.generateDistrictMetrics()
    this.generateCoordinationEvents()
  }

  private startDataGeneration() {
    // Update vehicle positions every 5 seconds
    setInterval(() => {
      this.updateVehiclePositions()
    }, 5000)

    // Update intersection states every 10 seconds
    setInterval(() => {
      this.updateIntersectionStates()
    }, 10000)

    // Generate new metrics every 30 seconds
    setInterval(() => {
      this.generateSystemMetrics()
      this.generateFleetStatistics()
      this.generateDistrictMetrics()
    }, 30000)

    // Generate coordination events every 15 seconds
    setInterval(() => {
      this.generateCoordinationEvents()
    }, 15000)

    // Clean old data every minute
    setInterval(() => {
      this.cleanOldData()
    }, 60000)
  }

  private updateVehiclePositions() {
    this.vehicles.forEach(vehicle => {
      if (vehicle.status === 'enroute' || vehicle.status === 'pickup') {
        // Small movement for active vehicles
        const deltaLat = (Math.random() - 0.5) * 0.002 // ~200m max movement
        const deltaLng = (Math.random() - 0.5) * 0.002
        
        vehicle.latitude = Math.max(SF_BOUNDS.south, Math.min(SF_BOUNDS.north, vehicle.latitude + deltaLat))
        vehicle.longitude = Math.max(SF_BOUNDS.west, Math.min(SF_BOUNDS.east, vehicle.longitude + deltaLng))
        vehicle.timestamp = new Date().toISOString()
        
        // Update district based on new position
        vehicle.anonymized_data.district = getRandomDistrict()
        vehicle.anonymized_data.wait_time = Math.random() * 15 + 2
      }
      
      // Occasionally change status
      if (Math.random() > 0.95) {
        const statuses: MockVehicleState['status'][] = ['idle', 'pickup', 'enroute', 'charging']
        vehicle.status = statuses[Math.floor(Math.random() * statuses.length)]
      }
    })

    this.notifySubscribers('vehicle_states', 'UPDATE')
  }

  private updateIntersectionStates() {
    this.intersections.forEach(intersection => {
      intersection.timestamp = new Date().toISOString()
      
      // Update queue lengths
      Object.keys(intersection.queue_lengths).forEach(direction => {
        const change = Math.floor(Math.random() * 3) - 1 // -1, 0, or 1
        intersection.queue_lengths[direction] = Math.max(0, 
          Math.min(12, intersection.queue_lengths[direction] + change))
      })
      
      // Update average wait time
      intersection.average_wait_time = Math.random() * 25 + 5
      
      // Update active negotiations
      if (Math.random() > 0.8) {
        intersection.active_negotiations = Math.random() > 0.5 ? 
          Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => ({
            vehicle_id: this.vehicles[Math.floor(Math.random() * this.vehicles.length)].vehicle_id,
            priority: Math.floor(Math.random() * 10) + 1,
            eta: Math.random() * 30 + 5
          })) : []
      }
    })

    this.notifySubscribers('intersection_states', 'UPDATE')
  }

  private generateSystemMetrics() {
    const totalVehicles = this.vehicles.length
    const activeVehicles = this.vehicles.filter(v => v.status !== 'idle' && v.status !== 'charging').length
    const recentEvents = this.coordinationEvents.filter(e => 
      new Date(e.timestamp).getTime() > Date.now() - 60000).length

    const metric: MockSystemMetrics = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      total_vehicles: totalVehicles,
      coordinations_per_minute: recentEvents,
      average_wait_reduction: 0.25 + Math.random() * 0.25, // 25-50%
      fairness_score: 0.75 + Math.random() * 0.2, // 75-95%
      emergency_response_time: Math.random() * 60 + 120, // 2-3 minutes
      district_congestion_levels: Object.fromEntries(
        SF_DISTRICTS.map(district => [
          district, 
          Math.random() * 0.6 + 0.1 // 10-70% congestion
        ])
      )
    }

    this.systemMetrics.push(metric)
    this.notifySubscribers('system_metrics', 'INSERT', metric)
  }

  private generateFleetStatistics() {
    ['waymo', 'zoox', 'cruise'].forEach(company => {
      const fleetVehicles = this.vehicles.filter(v => v.company === company)
      const activeVehicles = fleetVehicles.filter(v => v.status !== 'idle' && v.status !== 'charging').length
      const idleVehicles = fleetVehicles.filter(v => v.status === 'idle').length

      const stat: MockFleetStatistics = {
        id: uuidv4(),
        company: company as 'waymo' | 'zoox' | 'cruise',
        timestamp: new Date().toISOString(),
        active_vehicles: activeVehicles,
        idle_vehicles: idleVehicles,
        passenger_miles: Math.random() * 500 + 200, // 200-700 miles
        average_wait_time: Math.random() * 10 + 5, // 5-15 minutes
        priority_score: Math.random() * 30 + 70 // 70-100
      }

      this.fleetStatistics.push(stat)
    })
  }

  private generateDistrictMetrics() {
    SF_DISTRICTS.forEach(district => {
      const districtVehicles = this.vehicles.filter(v => 
        v.anonymized_data.district === district)
      
      const metric: MockDistrictMetrics = {
        id: uuidv4(),
        district,
        timestamp: new Date().toISOString(),
        vehicle_count: districtVehicles.length,
        congestion_level: Math.random() * 0.7 + 0.1, // 10-80%
        average_wait_time: Math.random() * 15 + 5, // 5-20 minutes
        coordination_score: Math.random() * 0.3 + 0.7, // 70-100%
        active_negotiations: Math.floor(Math.random() * 5)
      }

      this.districtMetrics.push(metric)
    })
  }

  private generateCoordinationEvents() {
    const eventTypes: MockCoordinationEvent['event_type'][] = [
      'intersection_negotiation', 'fleet_rebalancing', 'congestion_mitigation', 'special_event'
    ]
    
    // Generate 1-3 events
    const numEvents = Math.floor(Math.random() * 3) + 1
    
    for (let i = 0; i < numEvents; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      const participants = Array.from({ length: Math.floor(Math.random() * 4) + 2 }, () => 
        this.vehicles[Math.floor(Math.random() * this.vehicles.length)].vehicle_id)

      const event: MockCoordinationEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        event_type: eventType,
        participants,
        outcome: {
          success: Math.random() > 0.2,
          efficiency_gain: Math.random() * 0.3 + 0.1,
          time_saved: Math.random() * 120 + 30
        },
        metrics: {
          wait_time_saved: Math.random() * 60 + 10,
          efficiency_score: Math.random() * 0.3 + 0.7,
          vehicles_coordinated: participants.length
        },
        details: {
          intersection: eventType === 'intersection_negotiation' ? 
            this.intersections[Math.floor(Math.random() * this.intersections.length)].intersection_id : undefined,
          district: getRandomDistrict()
        }
      }

      this.coordinationEvents.push(event)
    }
  }

  private cleanOldData() {
    const hourAgo = Date.now() - 3600000 // 1 hour
    const fiveMinutesAgo = Date.now() - 300000 // 5 minutes

    // Keep only recent metrics
    this.systemMetrics = this.systemMetrics.filter(m => 
      new Date(m.timestamp).getTime() > hourAgo)
    
    this.coordinationEvents = this.coordinationEvents.filter(e => 
      new Date(e.timestamp).getTime() > hourAgo)
    
    this.fleetStatistics = this.fleetStatistics.filter(f => 
      new Date(f.timestamp).getTime() > hourAgo)
    
    this.districtMetrics = this.districtMetrics.filter(d => 
      new Date(d.timestamp).getTime() > hourAgo)

    // Clean expired messages
    this.coordinationMessages = this.coordinationMessages.filter(m => 
      new Date(m.timestamp).getTime() + (m.ttl * 1000) > Date.now())
  }

  private notifySubscribers(table: string, event: string, data?: any) {
    const key = `${table}:${event}`
    const callbacks = this.subscribers.get(key) || []
    callbacks.forEach(callback => callback(data))
  }

  // Public API methods to simulate Supabase

  from(table: string) {
    return {
      select: (columns: string = '*', options?: any) => new MockQueryBuilder(this, table, columns, {}, options),
      insert: (data: any | any[]) => this.insert(table, data),
      update: (data: any) => ({
        eq: (column: string, value: any) => this.update(table, data, { [column]: value })
      })
    }
  }

  public query(table: string, columns: string, filters: any = {}, options: any = {}) {
    let data: any[] = []
    
    switch (table) {
      case 'vehicle_states':
        data = [...this.vehicles]
        break
      case 'intersection_states':
        data = [...this.intersections]
        break
      case 'system_metrics':
        data = [...this.systemMetrics]
        break
      case 'coordination_events':
        data = [...this.coordinationEvents]
        break
      case 'coordination_messages':
        data = [...this.coordinationMessages]
        break
      case 'fleet_statistics':
        data = [...this.fleetStatistics]
        break
      case 'district_metrics':
        data = [...this.districtMetrics]
        break
      case 'intersection_metrics':
        data = [...this.intersectionMetrics]
        break
      default:
        return { data: [], error: null, count: 0 }
    }

    // Apply filters
    Object.keys(filters).forEach(key => {
      const value = filters[key]
      if (key.endsWith('_gte')) {
        const field = key.replace('_gte', '')
        data = data.filter(item => new Date(item[field]).getTime() >= new Date(value).getTime())
      } else if (key.endsWith('_lte')) {
        const field = key.replace('_lte', '')
        data = data.filter(item => new Date(item[field]).getTime() <= new Date(value).getTime())
      } else {
        data = data.filter(item => item[key] === value)
      }
    })

    // Apply ordering
    if (options.orderBy) {
      const ascending = options.ascending !== false
      data.sort((a, b) => {
        const aVal = a[options.orderBy]
        const bVal = b[options.orderBy]
        if (ascending) {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        }
      })
    }

    // Apply limit
    if (options.limit) {
      data = data.slice(0, options.limit)
    }

    const count = data.length

    // Return single item if requested
    if (options.single) {
      return { data: data[0] || null, error: null, count }
    }

    // Handle count-only requests
    if (options.count === 'exact' && options.head) {
      return { data: null, error: null, count }
    }

    return { data, error: null, count }
  }

  private insert(table: string, data: any | any[]) {
    const items = Array.isArray(data) ? data : [data]
    
    items.forEach(item => {
      const newItem = { ...item, id: item.id || uuidv4() }
      
      switch (table) {
        case 'coordination_messages':
          this.coordinationMessages.push(newItem)
          break
        case 'coordination_events':
          this.coordinationEvents.push(newItem)
          break
        case 'system_metrics':
          this.systemMetrics.push(newItem)
          break
        // Add other tables as needed
      }
    })

    return Promise.resolve({ data: items, error: null })
  }

  private update(table: string, updateData: any, filters: any) {
    // Implementation for updates
    return Promise.resolve({ data: updateData, error: null })
  }

  // Subscription methods (simplified for mock)
  channel(name: string) {
    return {
      on: (event: string, config: any, callback: Function) => {
        // For mock data, we don't need real subscriptions
        return this
      },
      subscribe: () => {
        return { unsubscribe: () => {} }
      }
    }
  }
}

// Create singleton instance
export const mockDataStore = new MockDataStore()

// Export the mock supabase client
export const mockSupabase = mockDataStore
