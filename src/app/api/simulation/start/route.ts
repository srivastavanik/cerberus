import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createFleetCoordinators } from '@/lib/agents/fleet-coordinator'
import { MasterOrchestratorAgent } from '@/lib/agents/master-orchestrator'
import { createMajorIntersections } from '@/lib/agents/intersection-agent'
import { createDistrictAgents } from '@/lib/agents/district-agent'
import type { DistrictMetrics } from '@/lib/supabase'

// Global simulation state
let simulationRunning = false
let agentSystem: {
  masterOrchestrator?: MasterOrchestratorAgent
  fleetCoordinators?: any[]
  intersectionAgents?: any[]
  districtAgents?: any[]
} = {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scenario = 'normal', duration = 3600, enableAI = true } = body

    if (simulationRunning) {
      return NextResponse.json({ 
        error: 'Simulation already running',
        status: 'running'
      }, { status: 400 })
    }

    console.log(`Starting SF AV coordination simulation - Scenario: ${scenario}`)

    // Initialize agent system
    agentSystem.masterOrchestrator = new MasterOrchestratorAgent()

    agentSystem.fleetCoordinators = createFleetCoordinators()
    agentSystem.intersectionAgents = createMajorIntersections()
    agentSystem.districtAgents = createDistrictAgents()

    // Start all agents
    await agentSystem.masterOrchestrator.start()
    
    for (const agent of agentSystem.fleetCoordinators) {
      await agent.start()
    }
    
    for (const agent of agentSystem.intersectionAgents) {
      await agent.start()
    }
    
    for (const agent of agentSystem.districtAgents) {
      await agent.start()
    }

    simulationRunning = true

    // Log simulation start
    const { error: logError } = await supabase
      .from('system_metrics')
      .insert({
        simulation_status: 'running',
        scenario_type: scenario,
        agents_active: (
          agentSystem.fleetCoordinators?.length || 0
        ) + (
          agentSystem.intersectionAgents?.length || 0  
        ) + (
          agentSystem.districtAgents?.length || 0
        ) + 1, // +1 for master orchestrator
        simulation_start_time: new Date().toISOString(),
        ai_enabled: enableAI
      })

    if (logError) {
      console.error('Error logging simulation start:', logError)
    }

    // Apply scenario-specific configurations
    await applyScenario(scenario)

    // Set up simulation monitoring
    startSimulationMonitoring(duration)

    // Generate initial events
    await generateSimulationEvents()

    return NextResponse.json({
      success: true,
      message: `SF AV Coordination simulation started with ${scenario} scenario`,
      simulation: {
        status: 'running',
        scenario,
        duration,
        agents: {
          masterOrchestrator: 1,
          fleetCoordinators: agentSystem.fleetCoordinators?.length || 0,
          intersectionAgents: agentSystem.intersectionAgents?.length || 0,
          districtAgents: agentSystem.districtAgents?.length || 0
        },
        aiEnabled: enableAI,
        startTime: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Simulation start error:', error)
    simulationRunning = false
    
    return NextResponse.json({
      error: 'Failed to start simulation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current simulation status
    const { data: latestMetrics } = await supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      running: simulationRunning,
      status: simulationRunning ? 'running' : 'stopped',
      agents: agentSystem,
      metrics: latestMetrics,
      activeAgents: Object.keys(agentSystem).length
    })

  } catch (error) {
    console.error('Error getting simulation status:', error)
    return NextResponse.json({
      error: 'Failed to get simulation status'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!simulationRunning) {
      return NextResponse.json({
        message: 'No simulation currently running',
        status: 'stopped'
      })
    }

    console.log('Stopping SF AV coordination simulation...')

    // Stop all agents gracefully
    if (agentSystem.masterOrchestrator) {
      await agentSystem.masterOrchestrator.stop()
    }

    for (const agent of agentSystem.fleetCoordinators || []) {
      await agent.stop()
    }

    for (const agent of agentSystem.intersectionAgents || []) {
      await agent.stop()
    }

    for (const agent of agentSystem.districtAgents || []) {
      await agent.stop()
    }

    // Clear agent system
    agentSystem = {}
    simulationRunning = false

    // Log simulation stop
    await supabase
      .from('system_metrics')
      .insert({
        simulation_status: 'stopped',
        simulation_end_time: new Date().toISOString(),
        total_events_processed: Math.floor(Math.random() * 1000) + 500
      })

    return NextResponse.json({
      success: true,
      message: 'Simulation stopped successfully',
      status: 'stopped',
      stoppedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error stopping simulation:', error)
    return NextResponse.json({
      error: 'Failed to stop simulation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function applyScenario(scenario: string) {
  switch (scenario) {
    case 'rush_hour':
      // Increase vehicle density and coordination demands
      const { data: rushDistricts } = await supabase
        .from('district_metrics')
        .select('*')
        .returns<DistrictMetrics[]>()
      
      if (rushDistricts) {
        for (const district of rushDistricts) {
          await supabase
            .from('district_metrics')
            .update({
              vehicle_density: Math.floor(district.vehicle_density * 1.5),
              congestion_level: Math.min(district.congestion_level + 3, 10)
            })
            .eq('district_name', district.district_name)
        }
      }
      break

    case 'emergency':
      // Trigger emergency scenario with ambulance/fire department
      await generateEmergencyEvent()
      break

    case 'special_event':
      // Simulate Giants game or concert ending
      await generateSpecialEventTraffic()
      break

    case 'weather':
      // Reduce speeds and increase caution  
      const { data: districts } = await supabase
        .from('district_metrics')
        .select('*')
        .returns<DistrictMetrics[]>()
      
      if (districts) {
        for (const district of districts) {
          await supabase
            .from('district_metrics')
            .update({
              average_speed: Math.floor(district.average_speed * 0.7),
              congestion_level: Math.min(district.congestion_level + 2, 10)
            })
            .eq('district_name', district.district_name)
        }
      }
      break

    default: // normal
      console.log('Running normal traffic scenario')
  }
}

async function generateEmergencyEvent() {
  const emergencyPath = [
    [-122.4194, 37.7749], // Van Ness & Market
    [-122.4078, 37.7853], // Market & Powell
    [-122.4035, 37.7879], // Market & Montgomery
    [-122.3994, 37.7849]  // End at Chinatown
  ]

  await supabase
    .from('coordination_events')
    .insert({
      event_id: `emergency_${Date.now()}`,
      event_type: 'emergency_corridor',
      participants: ['emergency_vehicle_001'],
      location: { type: 'Point', coordinates: emergencyPath[0] },
      priority: 1000,
      duration_ms: 300000, // 5 minutes
      success_rate: 100,
      coordination_algorithm: 'emergency_override',
      outcome: {
        corridor_created: true,
        vehicles_affected: Math.floor(Math.random() * 50) + 20,
        time_saved: Math.floor(Math.random() * 180) + 120 // 2-5 minutes
      },
      metadata: {
        emergency_type: 'medical',
        path: emergencyPath,
        eta_improvement: '40%'
      }
    })
}

async function generateSpecialEventTraffic() {
  // Simulate Oracle Park (Giants stadium) traffic
  const oracleParkLocation = [-122.3892, 37.7786]
  
  await supabase
    .from('coordination_events')
    .insert({
      event_id: `special_event_${Date.now()}`,
      event_type: 'surge_management',
      participants: ['event_coordinator'],
      location: { type: 'Point', coordinates: oracleParkLocation },
      priority: 800,
      duration_ms: 7200000, // 2 hours
      coordination_algorithm: 'load_balancing',
      outcome: {
        vehicles_rebalanced: Math.floor(Math.random() * 100) + 150,
        congestion_reduced: Math.floor(Math.random() * 30) + 20, // 20-50% reduction
        alternative_routes: 5
      },
      metadata: {
        event_type: 'giants_game',
        expected_attendees: 35000,
        peak_departure_time: new Date(Date.now() + 3600000).toISOString()
      }
    })
}

function startSimulationMonitoring(duration: number) {
  // Update metrics every 30 seconds
  const monitoringInterval = setInterval(async () => {
    if (!simulationRunning) {
      clearInterval(monitoringInterval)
      return
    }

    await updateSimulationMetrics()
  }, 30000)

  // Auto-stop simulation after duration
  setTimeout(async () => {
    if (simulationRunning) {
      console.log('Auto-stopping simulation after duration limit')
      simulationRunning = false
      
      // Clean up agents
      for (const agent of agentSystem.fleetCoordinators || []) {
        await agent.stop()
      }
      
      agentSystem = {}
      clearInterval(monitoringInterval)
    }
  }, duration * 1000)
}

async function updateSimulationMetrics() {
  try {
    // Calculate current metrics
    const { data: vehicles } = await supabase
      .from('vehicle_states')
      .select('status, company')
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())

    const { data: events } = await supabase
      .from('coordination_events')
      .select('success_rate')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString())

    const totalVehicles = vehicles?.length || 0
    const activeVehicles = vehicles?.filter(v => v.status !== 'idle').length || 0
    const avgSuccessRate = events?.length 
      ? events.reduce((sum, e) => sum + (e.success_rate as number || 0), 0) / events.length
      : 95

    await supabase
      .from('system_metrics')
      .insert({
        total_vehicles: totalVehicles,
        active_vehicles: activeVehicles,
        coordination_events: events?.length || 0,
        system_efficiency: Math.min(100, avgSuccessRate + Math.floor(Math.random() * 10)),
        coordination_score: Math.floor(avgSuccessRate),
        simulation_status: 'running'
      })

  } catch (error) {
    console.error('Error updating simulation metrics:', error)
  }
}

async function generateSimulationEvents() {
  // Generate realistic coordination events during simulation
  const eventTypes = [
    'intersection_negotiation',
    'lane_merge', 
    'rebalancing',
    'charging_coordination',
    'pickup_optimization'
  ]

  for (let i = 0; i < 10; i++) {
    setTimeout(async () => {
      if (!simulationRunning) return

      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      const participants = [`waymo-${String(Math.floor(Math.random() * 250)).padStart(3, '0')}`, 
                           `cruise-${String(Math.floor(Math.random() * 300)).padStart(3, '0')}`]

      await supabase
        .from('coordination_events')
        .insert({
          event_id: `sim_${Date.now()}_${i}`,
          event_type: eventType,
          participants,
          location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
          duration_ms: Math.floor(Math.random() * 20000) + 5000,
          success_rate: Math.random() > 0.15 ? 100 : 0, // 85% success rate
          coordination_algorithm: 'auction_based',
          outcome: {
            time_saved: Math.floor(Math.random() * 45) + 5,
            fuel_saved: Math.random() * 0.3,
            fairness_score: Math.floor(Math.random() * 20) + 80
          }
        })
    }, Math.random() * 60000) // Random timing within first minute
  }
}
