import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('Stopping agent system...')

    // Update system metrics
    await supabase
      .from('system_metrics')
      .insert({
        simulation_status: 'stopped',
        agents_active: 0,
        system_message: 'Agent system stopped',
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Agent system stopped successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error stopping agents:', error)
    return NextResponse.json({
      error: 'Failed to stop agent system',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
