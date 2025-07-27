import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SF_DISTRICTS = [
  'financial', 'soma', 'mission', 'castro', 'haight',
  'richmond', 'sunset', 'marina', 'northbeach', 'chinatown',
  'tenderloin', 'nobhill'
]

const COMPANIES = ['waymo', 'zoox', 'cruise']

const VEHICLE_STATUSES = ['idle', 'enroute', 'charging', 'pickup', 'emergency_yield'] as const

interface GenerateDataParams {
  vehicleCount?: number
  timeRange?: number // minutes
  scenario?: 'normal' | 'rush_hour' | 'emergency' | 'special_event'
}

export async function POST(request: NextRequest) {
  try {
    const params: GenerateDataParams = await request.json()
    const {
      vehicleCount = 750, // 250 Waymo, 200 Zoox, 300 Cruise
      timeRange = 60,
      scenario = 'normal'
    } = params

    console.log(`Generating traffic data: ${vehicleCount} vehicles, ${timeRange} min range, ${scenario} scenario`)

    // Clear existing data
    await supabase.from('vehicle_states').delete().gte('id', 0)
    await supabase.from('district_metrics').delete().gte('id', 0)
    await supabase.from('intersection_metrics').delete().gte('id', 0)

    // Generate vehicle states
    const vehicleStates = generateVehicleStates(vehicleCount, timeRange, scenario)
    
    // Insert vehicle states in batches
    const batchSize = 100
    for (let i = 0; i < vehicleStates.length; i += batchSize) {
      const batch = vehicleStates.slice(i, i + batchSize)
      const { error } = await supabase.from('vehicle_states').insert(batch)
      if (error) {
        console.error('Error inserting vehicle states:', error)
      }
    }

    // Generate district metrics
    const districtMetrics = generateDistrictMetrics(vehicleStates, scenario)
    const { error: districtError } = await supabase
      .from('district_metrics')
      .insert(districtMetrics)
    
    if (districtError) {
      console.error('Error inserting district metrics:', districtError)
    }

    // Generate intersection metrics
    const intersectionMetrics = generateIntersectionMetrics(scenario)
    const { error: intersectionError } = await supabase
      .from('intersection_metrics')
      .insert(intersectionMetrics)
    
    if (intersectionError) {
      console.error('Error inserting intersection metrics:', intersectionError)
    }

    // Generate initial coordination events
    const coordinationEvents = generateCoordinationEvents(timeRange, scenario)
    const { error: eventError } = await supabase
      .from('coordination_events')
      .insert(coordinationEvents)
    
    if (eventError) {
      console.error('Error inserting coordination events:', eventError)
    }

    // Generate fleet statistics
    const fleetStats = generateFleetStatistics(vehicleStates)
    const { error: fleetError } = await supabase
      .from('fleet_statistics')
      .insert(fleetStats)
    
    if (fleetError) {
      console.error('Error inserting fleet statistics:', fleetError)
    }

    return NextResponse.json({
      success: true,
      message: 'Traffic data generated successfully',
      summary: {
        vehicleStates: vehicleStates.length,
        districtMetrics: districtMetrics.length,
        intersectionMetrics: intersectionMetrics.length,
        coordinationEvents: coordinationEvents.length,
        fleetStatistics: fleetStats.length,
        scenario,
        timeRange: `${timeRange} minutes`
      }
    })

  } catch (error) {
    console.error('Error generating traffic data:', error)
    return NextResponse.json({
      error: 'Failed to generate traffic data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function generateVehicleStates(count: number, timeRange: number, scenario: string) {
  const states = []
  const now = new Date()
  
  // Distribute vehicles across companies
  const waymoCount = Math.floor(count * 0.33)
  const zooxCount = Math.floor(count * 0.27)
  const cruiseCount = count - waymoCount - zooxCount

  let vehicleId = 0
  
  // Generate vehicles for each company
  for (const [company, companyCount] of [
    ['waymo', waymoCount],
    ['zoox', zooxCount],
    ['cruise', cruiseCount]
  ] as const) {
    for (let i = 0; i < companyCount; i++) {
      const timeOffset = Math.random() * timeRange * 60 * 1000
      const timestamp = new Date(now.getTime() - timeOffset)
      
      // Generate random SF coordinates (roughly within city bounds)
      const lat = 37.7749 + (Math.random() - 0.5) * 0.1
      const lng = -122.4194 + (Math.random() - 0.5) * 0.15
      
      const district = SF_DISTRICTS[Math.floor(Math.random() * SF_DISTRICTS.length)]
      const status = selectVehicleStatus(scenario)
      
      states.push({
        vehicle_id: `${company}-${String(vehicleId++).padStart(3, '0')}`,
        company,
        status,
        grid_position: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        battery_level: status === 'charging' ? Math.random() * 50 : 50 + Math.random() * 50,
        passenger_count: status === 'enroute' ? Math.floor(Math.random() * 4) + 1 : 0,
        timestamp: timestamp.toISOString(),
        anonymized_data: {
          district,
          wait_time: status === 'idle' ? Math.floor(Math.random() * 300) : 0,
          trip_distance: status === 'enroute' ? Math.random() * 10 : null
        }
      })
    }
  }
  
  return states
}

function selectVehicleStatus(scenario: string): typeof VEHICLE_STATUSES[number] {
  const weights = {
    normal: { idle: 0.4, enroute: 0.45, charging: 0.1, pickup: 0.05, emergency_yield: 0 },
    rush_hour: { idle: 0.15, enroute: 0.7, charging: 0.05, pickup: 0.1, emergency_yield: 0 },
    emergency: { idle: 0.3, enroute: 0.4, charging: 0.1, pickup: 0.05, emergency_yield: 0.15 },
    special_event: { idle: 0.1, enroute: 0.65, charging: 0.05, pickup: 0.2, emergency_yield: 0 }
  }
  
  const scenarioWeights = weights[scenario as keyof typeof weights] || weights.normal
  const rand = Math.random()
  let cumulative = 0
  
  for (const [status, weight] of Object.entries(scenarioWeights)) {
    cumulative += weight
    if (rand < cumulative) {
      return status as typeof VEHICLE_STATUSES[number]
    }
  }
  
  return 'idle'
}

function generateDistrictMetrics(vehicleStates: any[], scenario: string) {
  const districtCounts: Record<string, number> = {}
  
  // Count vehicles per district
  vehicleStates.forEach(vehicle => {
    const district = vehicle.anonymized_data.district
    districtCounts[district] = (districtCounts[district] || 0) + 1
  })
  
  // Generate metrics for each district
  return SF_DISTRICTS.map(district => {
    const vehicleCount = districtCounts[district] || 0
    const baseCapacity = getDistrictCapacity(district)
    const density = vehicleCount / baseCapacity
    
    let congestionLevel = Math.min(10, Math.floor(density * 10))
    let avgSpeed = 25 // mph
    
    // Adjust for scenario
    if (scenario === 'rush_hour') {
      congestionLevel = Math.min(10, congestionLevel + 2)
      avgSpeed = Math.max(10, avgSpeed - 10)
    } else if (scenario === 'special_event' && ['soma', 'mission'].includes(district)) {
      congestionLevel = Math.min(10, congestionLevel + 3)
      avgSpeed = Math.max(8, avgSpeed - 12)
    }
    
    return {
      district_name: district,
      vehicle_density: vehicleCount,
      congestion_level: congestionLevel,
      average_speed: avgSpeed,
      active_intersections: Math.floor(Math.random() * 15) + 10,
      coordination_score: Math.max(0, 100 - congestionLevel * 10),
      timestamp: new Date().toISOString()
    }
  })
}

function getDistrictCapacity(district: string): number {
  const capacities: Record<string, number> = {
    financial: 150,
    soma: 200,
    mission: 180,
    castro: 120,
    haight: 100,
    richmond: 160,
    sunset: 180,
    marina: 140,
    northbeach: 110,
    chinatown: 90,
    tenderloin: 80,
    nobhill: 100
  }
  return capacities[district] || 120
}

function generateIntersectionMetrics(scenario: string) {
  const majorIntersections = [
    { name: 'Market & Van Ness', location: [-122.4194, 37.7749] },
    { name: 'Market & Powell', location: [-122.4078, 37.7853] },
    { name: 'Market & Montgomery', location: [-122.4035, 37.7879] },
    { name: 'Mission & 16th', location: [-122.4197, 37.7652] },
    { name: 'Mission & 24th', location: [-122.4184, 37.7529] },
    { name: 'Van Ness & Geary', location: [-122.4227, 37.7857] },
    { name: 'Van Ness & Lombard', location: [-122.4228, 37.8023] },
    { name: 'Columbus & Broadway', location: [-122.4064, 37.7981] },
    { name: '19th & Lincoln', location: [-122.4745, 37.7656] },
    { name: 'Divisadero & Haight', location: [-122.4371, 37.7717] }
  ]
  
  return majorIntersections.map(intersection => {
    let throughput = 150 + Math.floor(Math.random() * 100)
    let avgWaitTime = 20 + Math.floor(Math.random() * 40)
    let congestionScore = Math.floor(Math.random() * 5) + 1
    
    // Adjust for scenario
    if (scenario === 'rush_hour') {
      throughput = Math.floor(throughput * 0.7)
      avgWaitTime = Math.floor(avgWaitTime * 1.5)
      congestionScore = Math.min(10, congestionScore + 3)
    } else if (scenario === 'emergency') {
      avgWaitTime = Math.floor(avgWaitTime * 1.2)
    }
    
    return {
      intersection_id: intersection.name.toLowerCase().replace(/\s+/g, '_'),
      intersection_name: intersection.name,
      throughput_per_hour: throughput,
      average_wait_time: avgWaitTime,
      congestion_score: congestionScore,
      signal_efficiency: Math.max(40, 100 - congestionScore * 8),
      coordination_active: Math.random() > 0.3,
      timestamp: new Date().toISOString()
    }
  })
}

function generateCoordinationEvents(timeRange: number, scenario: string) {
  const events = []
  const eventCount = scenario === 'normal' ? 20 : scenario === 'rush_hour' ? 50 : 35
  const now = new Date()
  
  const eventTypes = [
    'intersection_negotiation',
    'lane_merge',
    'rebalancing',
    'charging_coordination',
    'pickup_optimization',
    'emergency_corridor',
    'surge_management'
  ]
  
  for (let i = 0; i < eventCount; i++) {
    const timeOffset = Math.random() * timeRange * 60 * 1000
    const timestamp = new Date(now.getTime() - timeOffset)
    
    const eventType = scenario === 'emergency' && Math.random() > 0.7
      ? 'emergency_corridor'
      : eventTypes[Math.floor(Math.random() * (eventTypes.length - 2))]
    
    const participants = generateParticipants(eventType)
    const location = generateEventLocation()
    
    events.push({
      event_id: `event_${timestamp.getTime()}_${i}`,
      event_type: eventType,
      participants,
      location: { type: 'Point', coordinates: location },
      timestamp: timestamp.toISOString(),
      duration_ms: generateDuration(eventType),
      success_rate: Math.random() > 0.1 ? 100 : 0, // 90% success rate
      priority: generatePriority(eventType),
      coordination_algorithm: selectAlgorithm(eventType),
      outcome: generateOutcome(eventType),
      metadata: generateMetadata(eventType, scenario)
    })
  }
  
  return events
}

function generateParticipants(eventType: string): string[] {
  const count = eventType === 'emergency_corridor' ? 10 : Math.floor(Math.random() * 4) + 2
  const participants = []
  
  for (let i = 0; i < count; i++) {
    const company = COMPANIES[Math.floor(Math.random() * COMPANIES.length)]
    const id = Math.floor(Math.random() * 300)
    participants.push(`${company}-${String(id).padStart(3, '0')}`)
  }
  
  return participants
}

function generateEventLocation(): [number, number] {
  // Random location within SF bounds
  const lat = 37.7749 + (Math.random() - 0.5) * 0.1
  const lng = -122.4194 + (Math.random() - 0.5) * 0.15
  return [lng, lat]
}

function generateDuration(eventType: string): number {
  const durations: Record<string, [number, number]> = {
    intersection_negotiation: [5000, 20000],
    lane_merge: [10000, 30000],
    rebalancing: [60000, 300000],
    charging_coordination: [30000, 120000],
    pickup_optimization: [15000, 60000],
    emergency_corridor: [180000, 300000],
    surge_management: [600000, 1800000]
  }
  
  const [min, max] = durations[eventType] || [10000, 60000]
  return Math.floor(Math.random() * (max - min)) + min
}

function generatePriority(eventType: string): number {
  const priorities: Record<string, number> = {
    emergency_corridor: 1000,
    surge_management: 800,
    pickup_optimization: 600,
    intersection_negotiation: 500,
    lane_merge: 400,
    rebalancing: 300,
    charging_coordination: 200
  }
  return priorities[eventType] || 500
}

function selectAlgorithm(eventType: string): string {
  const algorithms: Record<string, string[]> = {
    intersection_negotiation: ['auction_based', 'priority_based', 'fair_queuing'],
    lane_merge: ['zipper_merge', 'courtesy_based', 'efficiency_optimized'],
    rebalancing: ['load_balancing', 'predictive_demand', 'game_theory'],
    charging_coordination: ['queue_optimization', 'battery_priority', 'grid_aware'],
    pickup_optimization: ['nearest_vehicle', 'passenger_pooling', 'route_optimized'],
    emergency_corridor: ['emergency_override', 'rapid_clearing'],
    surge_management: ['dynamic_pricing', 'zone_balancing', 'predictive_routing']
  }
  
  const algos = algorithms[eventType] || ['generic_coordination']
  return algos[Math.floor(Math.random() * algos.length)]
}

function generateOutcome(eventType: string): any {
  const outcomes: Record<string, () => any> = {
    intersection_negotiation: () => ({
      vehicles_processed: Math.floor(Math.random() * 20) + 10,
      avg_wait_reduction: Math.floor(Math.random() * 30) + 10,
      fairness_score: Math.floor(Math.random() * 20) + 80
    }),
    emergency_corridor: () => ({
      corridor_created: true,
      vehicles_affected: Math.floor(Math.random() * 50) + 20,
      time_saved: Math.floor(Math.random() * 180) + 120,
      emergency_eta_improvement: '35%'
    }),
    rebalancing: () => ({
      vehicles_moved: Math.floor(Math.random() * 30) + 10,
      congestion_reduced: Math.floor(Math.random() * 25) + 10,
      districts_balanced: Math.floor(Math.random() * 3) + 2
    })
  }
  
  const generator = outcomes[eventType] || (() => ({
    success: true,
    efficiency_gain: Math.floor(Math.random() * 30) + 10
  }))
  
  return generator()
}

function generateMetadata(eventType: string, scenario: string): any {
  return {
    scenario,
    event_type: eventType,
    ai_decision: Math.random() > 0.3,
    weather_impact: scenario === 'weather' ? 'high' : 'none',
    special_conditions: scenario === 'special_event' ? ['giants_game', 'high_demand'] : []
  }
}

function generateFleetStatistics(vehicleStates: any[]) {
  const fleetStats: Record<string, any> = {}
  
  // Group by company
  vehicleStates.forEach(vehicle => {
    if (!fleetStats[vehicle.company]) {
      fleetStats[vehicle.company] = {
        company: vehicle.company,
        total: 0,
        active: 0,
        idle: 0,
        charging: 0,
        totalPassengers: 0
      }
    }
    
    const stats = fleetStats[vehicle.company]
    stats.total++
    
    if (vehicle.status === 'idle') stats.idle++
    else if (vehicle.status === 'charging') stats.charging++
    else stats.active++
    
    stats.totalPassengers += vehicle.passenger_count || 0
  })
  
  // Convert to array format
  return Object.values(fleetStats).map(stats => ({
    company: stats.company,
    active_vehicles: stats.active,
    idle_vehicles: stats.idle,
    passenger_miles: stats.totalPassengers * (5 + Math.random() * 10), // Simulated
    average_wait_time: 120 + Math.floor(Math.random() * 180), // 2-5 minutes
    priority_score: 40 + Math.floor(Math.random() * 40),
    timestamp: new Date().toISOString()
  }))
}

export async function GET(request: NextRequest) {
  try {
    // Get data generation status
    const { data: vehicleCount } = await supabase
      .from('vehicle_states')
      .select('id', { count: 'exact' })
    
    const { data: districtCount } = await supabase
      .from('district_metrics')
      .select('id', { count: 'exact' })
    
    const { data: eventCount } = await supabase
      .from('coordination_events')
      .select('id', { count: 'exact' })
    
    return NextResponse.json({
      status: 'ready',
      dataAvailable: {
        vehicleStates: vehicleCount?.length || 0,
        districtMetrics: districtCount?.length || 0,
        coordinationEvents: eventCount?.length || 0
      },
      message: 'Use POST to generate new traffic data'
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get data status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
