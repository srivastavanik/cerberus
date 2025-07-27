import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role key for server-side operations to bypass RLS
export const supabase = typeof window === 'undefined' && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : createClient(supabaseUrl, supabaseAnonKey)

// Create a service role client for API routes
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

// Types for our database tables
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
  district: string
  timestamp: string
  vehicle_count: number
  congestion_level: number
  average_wait_time: number
  coordination_score: number
  active_negotiations?: number
}

export interface IntersectionMetrics {
  id: string
  intersection_id: string
  timestamp: string
  current_phase?: string
  traffic_level: 'low' | 'medium' | 'high'
  throughput: number
  average_wait_time: number
  active_negotiations?: any[]
}
