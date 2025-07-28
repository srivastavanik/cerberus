import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Singleton instances to prevent multiple client warnings
let supabaseInstance: ReturnType<typeof createClient> | null = null
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null

// Use service role key for server-side operations to bypass RLS
export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = typeof window === 'undefined' && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false }
        })
      : createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
})()

// Create a service role client for API routes
export const supabaseAdmin = (() => {
  if (!supabaseAdminInstance && supabaseServiceKey) {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
  }
  return supabaseAdminInstance
})()

// Types for our database tables
export interface Agent {
  id: string
  agent_id: string
  agent_type: 'city_orchestrator' | 'district_coordinator' | 'fleet_coordinator' | 'intersection_manager' | 'emergency_coordinator'
  name: string
  area_coverage?: string
  status: 'active' | 'inactive' | 'maintenance'
  capabilities: string[]
  priority_level: number
  last_active?: string
  created_at: string
}

export interface CoordinationEvent {
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
}

export interface VehicleState {
  id: string
  vehicle_id: string
  company: 'waymo' | 'zoox' | 'cruise'
  timestamp: string
  grid_position: {
    type: 'Point'
    coordinates: [number, number] // [lng, lat]
  }
  status: 'idle' | 'pickup' | 'enroute' | 'charging' | 'emergency_yield'
  anonymized_data: Record<string, any>
  battery_level?: number
  passenger_count?: number
}

export interface IntersectionState {
  id: string
  intersection_id: string
  timestamp: string
  queue_lengths: Record<string, number>
  average_wait_time: number
  active_negotiations: any[]
  traffic_light_state?: Record<string, any>
}

export interface SystemMetrics {
  id: string
  timestamp: string
  total_vehicles: number
  coordinations_per_minute: number
  average_wait_reduction: number
  fairness_score: number
  emergency_response_time?: number
  district_congestion_levels: Record<string, number>
}

export interface CoordinationMessage {
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

export interface FleetStatistics {
  id: string
  company: 'waymo' | 'zoox' | 'cruise'
  timestamp: string
  active_vehicles: number
  idle_vehicles: number
  passenger_miles: number
  average_wait_time: number
  priority_score: number
}

export interface DistrictMetrics {
  id: string
  district_name: string
  timestamp: string
  vehicle_density: number
  congestion_level: number
  average_speed: number
  active_intersections: number
  coordination_score: number
  created_at?: string
}

export interface IntersectionMetrics {
  id: string
  intersection_id: string
  intersection_name: string
  timestamp: string
  throughput_per_hour: number
  average_wait_time: number
  congestion_score: number
  signal_efficiency: number
  coordination_active: boolean
  created_at?: string
}
