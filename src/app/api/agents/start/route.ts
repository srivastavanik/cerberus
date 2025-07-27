import { NextRequest, NextResponse } from 'next/server'
import { MasterOrchestratorAgent } from '../../../../lib/agents/master-orchestrator'
import { IntersectionAgent } from '../../../../lib/agents/intersection-agent'
import { DistrictAgent } from '../../../../lib/agents/district-agent'
import { FleetCoordinatorAgent, createFleetCoordinators } from '../../../../lib/agents/fleet-coordinator'

// Global agent instances
let orchestrator: MasterOrchestratorAgent | null = null
let agents: {
  intersections: IntersectionAgent[]
  districts: DistrictAgent[]
  fleets: FleetCoordinatorAgent[]
} = {
  intersections: [],
  districts: [],
  fleets: []
}

export async function POST(request: NextRequest) {
  try {
    if (orchestrator) {
      return NextResponse.json({ 
        error: 'Agents already running',
        status: 'active'
      }, { status: 409 })
    }

    // Initialize Master Orchestrator
    orchestrator = new MasterOrchestratorAgent()
    await orchestrator.start()

    // Initialize Intersection Agents for major SF intersections
    const intersectionConfigs = [
      { id: 'market-powell', name: 'Market & Powell', location: { lat: 37.7851, lng: -122.4080 } },
      { id: 'market-montgomery', name: 'Market & Montgomery', location: { lat: 37.7894, lng: -122.4016 } },
      { id: 'market-embarcadero', name: 'Market & Embarcadero', location: { lat: 37.7939, lng: -122.3959 } },
      { id: 'van-ness-geary', name: 'Van Ness & Geary', location: { lat: 37.7812, lng: -122.4213 } },
      { id: 'van-ness-market', name: 'Van Ness & Market', location: { lat: 37.7742, lng: -122.4194 } },
      { id: 'castro-market', name: 'Castro & Market', location: { lat: 37.7609, lng: -122.4350 } },
      { id: 'lombard-hyde', name: 'Lombard & Hyde', location: { lat: 37.8021, lng: -122.4186 } },
      { id: 'broadway-columbus', name: 'Broadway & Columbus', location: { lat: 37.7983, lng: -122.4067 } },
      { id: 'california-stockton', name: 'California & Stockton', location: { lat: 37.7921, lng: -122.4077 } }
    ]

    for (const config of intersectionConfigs) {
      const agent = new IntersectionAgent(config.id, config.name, config.location)
      await agent.start()
      agents.intersections.push(agent)
    }

    // Initialize District Agents
    const districtConfigs = [
      {
        id: 'soma',
        name: 'SOMA',
        center: { lat: 37.7785, lng: -122.4056 },
        boundaries: [],
        adjacentDistricts: ['financial', 'mission'],
        capacity: 200
      },
      {
        id: 'mission',
        name: 'Mission District',
        center: { lat: 37.7599, lng: -122.4148 },
        boundaries: [],
        adjacentDistricts: ['soma', 'castro'],
        capacity: 180
      },
      {
        id: 'castro',
        name: 'Castro District',
        center: { lat: 37.7609, lng: -122.4350 },
        boundaries: [],
        adjacentDistricts: ['mission'],
        capacity: 120
      },
      {
        id: 'richmond',
        name: 'Richmond District',
        center: { lat: 37.7798, lng: -122.4836 },
        boundaries: [],
        adjacentDistricts: ['sunset'],
        capacity: 160
      },
      {
        id: 'sunset',
        name: 'Sunset District',
        center: { lat: 37.7485, lng: -122.4945 },
        boundaries: [],
        adjacentDistricts: ['richmond'],
        capacity: 180
      },
      {
        id: 'marina',
        name: 'Marina District',
        center: { lat: 37.8034, lng: -122.4363 },
        boundaries: [],
        adjacentDistricts: ['financial'],
        capacity: 140
      },
      {
        id: 'financial',
        name: 'Financial District',
        center: { lat: 37.7946, lng: -122.3999 },
        boundaries: [],
        adjacentDistricts: ['soma', 'marina'],
        capacity: 150
      }
    ]

    for (const config of districtConfigs) {
      const agent = new DistrictAgent(config)
      await agent.start()
      agents.districts.push(agent)
    }

    // Initialize Fleet Coordinators using the factory function
    const fleetAgents = createFleetCoordinators()
    for (const agent of fleetAgents) {
      await agent.start()
      agents.fleets.push(agent)
    }

    return NextResponse.json({
      message: 'All agents started successfully',
      agentCounts: {
        orchestrator: 1,
        intersections: agents.intersections.length,
        districts: agents.districts.length,
        fleets: agents.fleets.length
      },
      status: 'active'
    })

  } catch (error) {
    console.error('Failed to start agents:', error)
    return NextResponse.json({ 
      error: 'Failed to start agents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  const status = {
    orchestrator: orchestrator ? 'running' : 'stopped',
    intersectionAgents: agents.intersections.length,
    districtAgents: agents.districts.length,
    fleetAgents: agents.fleets.length,
    totalAgents: agents.intersections.length + agents.districts.length + agents.fleets.length
  }

  return NextResponse.json(status)
}
