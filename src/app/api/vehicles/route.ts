import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get all vehicle states
    const { data: vehicles, error, count } = await supabase
      .from('vehicle_states')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching vehicles:', error)
      return NextResponse.json({
        error: 'Failed to fetch vehicles',
        details: error.message
      }, { status: 500 })
    }

    // Get recent vehicles (last 2 minutes)
    const { data: recentVehicles, count: recentCount } = await supabase
      .from('vehicle_states')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', new Date(Date.now() - 120000).toISOString())

    return NextResponse.json({
      totalVehicles: count || 0,
      recentVehicles: recentCount || 0,
      sampleVehicles: vehicles || [],
      timeframe: '2 minutes ago: ' + new Date(Date.now() - 120000).toISOString(),
      currentTime: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in vehicles API:', error)
    return NextResponse.json({
      error: 'Failed to fetch vehicle data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
