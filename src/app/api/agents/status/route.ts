import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get latest system metrics
    const { data: systemMetrics } = await supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    // Get active agent counts
    const { data: fleetStats } = await supabase
      .from('fleet_statistics')
      .select('company, active_vehicles')
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())

    // Get district health
    const { data: districtMetrics } = await supabase
      .from('district_metrics')
      .select('district_name, vehicle_density, congestion_level')
      .order('congestion_level', { ascending: false })

    // Get recent coordination events
    const { data: recentEvents } = await supabase
      .from('coordination_events')
      .select('event_type, success_rate')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(10)

    const status = {
      system: {
        status: systemMetrics?.simulation_status || 'unknown',
        agentsActive: systemMetrics?.agents_active || 0,
        lastUpdate: systemMetrics?.timestamp || new Date().toISOString()
      },
      fleets: fleetStats || [],
      districts: districtMetrics || [],
      recentEvents: recentEvents || [],
      health: {
        coordinationScore: systemMetrics?.coordination_score || 0,
        systemEfficiency: systemMetrics?.system_efficiency || 0,
        totalVehicles: systemMetrics?.total_vehicles || 0,
        activeVehicles: systemMetrics?.active_vehicles || 0
      }
    }

    return NextResponse.json(status)

  } catch (error) {
    console.error('Error getting agent status:', error)
    return NextResponse.json({
      error: 'Failed to get agent status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
