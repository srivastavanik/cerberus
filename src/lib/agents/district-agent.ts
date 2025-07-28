import { BaseAgent, Message } from './base-agent'
import { supabase } from '../supabase'
import type { VehicleState } from '../supabase'

interface AdjacentDistrict {
  id: string
  boundary: [number, number][] // Array of [lng, lat] coordinates
}

interface DistrictConfig {
  id: string
  name: string
  center: { lat: number; lng: number }
  boundaries: [number, number][]
  adjacentDistricts: string[]
  capacity: number
  specialZones?: string[] // e.g., ['hospital', 'school', 'tourist']
}

export class DistrictAgent extends BaseAgent {
  private districtConfig: DistrictConfig
  private vehicleCount: number = 0
  private congestionLevel: number = 0
  private adjacentAgents: string[] = []
  private localIntersections: string[] = []

  constructor(config: DistrictConfig) {
    super({
      id: `district-${config.id}`,
      name: `District Agent - ${config.name}`,
      type: 'district',
      priority: 75
    })
    this.districtConfig = config
    this.adjacentAgents = config.adjacentDistricts.map(d => `district-${d}`)
  }

  setupMessageHandlers(): void {
    this.messageHandlers.set('vehicle-entry', this.handleVehicleEntry.bind(this))
    this.messageHandlers.set('vehicle-exit', this.handleVehicleExit.bind(this))
    this.messageHandlers.set('rebalancing-directive', this.handleRebalancingDirective.bind(this))
    this.messageHandlers.set('congestion-query', this.handleCongestionQuery.bind(this))
    this.messageHandlers.set('emergency-corridor', this.handleEmergencyCorridor.bind(this))
  }

  async processMessage(message: Message): Promise<void> {
    const handler = this.messageHandlers.get(message.payload.type)
    if (handler) {
      await handler(message)
    }
  }

  async makeDecision(context: any): Promise<any> {
    // Local decision making for district-level coordination
    const decision = {
      action: 'rebalance',
      targetDistricts: [] as string[],
      vehiclesToMove: 0,
      reasoning: ''
    }

    if (this.congestionLevel > 0.8) {
      // Find less congested adjacent districts
      const adjacentCongestion = await this.queryAdjacentCongestion()
      const targetDistricts = adjacentCongestion
        .filter(d => d.congestion < 0.5)
        .map(d => d.districtId)

      if (targetDistricts.length > 0) {
        decision.targetDistricts = targetDistricts
        decision.vehiclesToMove = Math.floor(this.vehicleCount * 0.2)
        decision.reasoning = `High congestion (${this.congestionLevel}), redistributing to adjacent districts`
      }
    }

    return decision
  }

  async start() {
    await super.start()
    
    // Start monitoring local conditions
    setInterval(() => this.monitorDistrictHealth(), 15000)
    
    // Report to master orchestrator
    setInterval(() => this.reportToMaster(), 30000)
  }

  private async handleVehicleEntry(message: Message) {
    const { vehicleId, company, fromDistrict } = message.payload
    
    // Update local vehicle count
    this.vehicleCount++
    this.updateCongestionLevel()

    // Log entry
    console.log(`Vehicle ${vehicleId} entered ${this.districtConfig.name} from ${fromDistrict}`)

    // Check if we need to trigger load balancing
    if (this.congestionLevel > 0.9) {
      await this.sendMessage(
        'master-orchestrator',
        'info',
        {
          type: 'congestion-alert',
          district: this.districtConfig.id,
          level: this.congestionLevel,
          vehicleCount: this.vehicleCount
        },
        8
      )
    }
  }

  private async handleVehicleExit(message: Message) {
    const { vehicleId, toDistrict } = message.payload
    
    // Update local vehicle count
    this.vehicleCount = Math.max(0, this.vehicleCount - 1)
    this.updateCongestionLevel()

    console.log(`Vehicle ${vehicleId} exited ${this.districtConfig.name} to ${toDistrict}`)
  }

  private async handleRebalancingDirective(message: Message) {
    const { action, priority } = message.payload
    
    console.log(`Received rebalancing directive: ${action}`)

    // Implement rebalancing logic
    if (action.includes('reduce')) {
      await this.initiateVehicleRedirection()
    } else if (action.includes('accept')) {
      // Prepare to accept vehicles from other districts
      await this.prepareForIncomingVehicles()
    }
  }

  private async handleCongestionQuery(message: Message) {
    await this.sendMessage(
      message.sender,
      'info',
      {
        type: 'congestion-response',
        districtId: this.districtConfig.id,
        congestion: this.congestionLevel,
        vehicleCount: this.vehicleCount,
        capacity: this.districtConfig.capacity
      }
    )
  }

  private async handleEmergencyCorridor(message: Message) {
    const { path, instructions } = message.payload
    
    // Check if emergency path intersects with district
    const intersects = this.checkPathIntersection(path)
    
    if (intersects) {
      console.log(`Emergency corridor active in ${this.districtConfig.name}`)
      
      // Notify local intersections
      await this.broadcast(
        this.localIntersections,
        'emergency',
        {
          type: 'emergency-preemption',
          duration: 300 // 5 minutes
        },
        1000
      )
      
      // Redirect vehicles away from corridor
      await this.redirectVehiclesFromCorridor(path)
    }
  }

  private updateCongestionLevel() {
    this.congestionLevel = Math.min(1, this.vehicleCount / this.districtConfig.capacity)
  }

  private async monitorDistrictHealth() {
    // Get current vehicles in district
    const { data: vehicles } = await supabase
      .from('vehicle_states')
      .select('*')
      .eq('anonymized_data->district', this.districtConfig.id)
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())

    this.vehicleCount = vehicles?.length || 0
    this.updateCongestionLevel()

    // Calculate metrics
    const vehicleStates = (vehicles || []) as unknown as VehicleState[]
    const metrics = {
      avgSpeed: this.calculateAverageSpeed(vehicleStates),
      stoppedVehicles: vehicleStates.filter(v => v.status === 'idle').length,
      chargingVehicles: vehicleStates.filter(v => v.status === 'charging').length
    }

    // Check for anomalies
    if (metrics.stoppedVehicles > this.vehicleCount * 0.3) {
      console.log(`High number of stopped vehicles in ${this.districtConfig.name}`)
    }
  }

  private async reportToMaster() {
    await this.sendMessage(
      'master-orchestrator',
      'info',
      {
        type: 'district-report',
        districtId: this.districtConfig.id,
        timestamp: new Date().toISOString(),
        metrics: {
          vehicleCount: this.vehicleCount,
          congestionLevel: this.congestionLevel,
          capacity: this.districtConfig.capacity,
          utilizationRate: this.vehicleCount / this.districtConfig.capacity
        }
      }
    )
  }

  private async queryAdjacentCongestion() {
    const responses: Array<{ districtId: string; congestion: number }> = []
    
    // Query each adjacent district
    for (const adjacentId of this.adjacentAgents) {
      await this.sendMessage(
        adjacentId,
        'info',
        {
          type: 'congestion-query',
          requester: this.config.id
        }
      )
    }

    // Wait for responses (simplified - in production would use proper async collection)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check messages for responses
    const { data: messages } = await supabase
      .from('coordination_messages')
      .select('*')
      .eq('recipient', this.config.id)
      .eq('payload->type', 'congestion-response')
      .gte('timestamp', new Date(Date.now() - 2000).toISOString())

    messages?.forEach(msg => {
      const payload = msg.payload as { districtId: string; congestion: number }
      responses.push({
        districtId: payload.districtId,
        congestion: payload.congestion
      })
    })

    return responses
  }

  private async initiateVehicleRedirection() {
    // Get vehicles that can be redirected
    const { data: vehicles } = await supabase
      .from('vehicle_states')
      .select('*')
      .eq('anonymized_data->district', this.districtConfig.id)
      .eq('status', 'idle')
      .limit(Math.floor(this.vehicleCount * 0.1))

    if (vehicles && vehicles.length > 0) {
      // Find best adjacent district
      const adjacentCongestion = await this.queryAdjacentCongestion()
      const targetDistrict = adjacentCongestion
        .sort((a, b) => a.congestion - b.congestion)[0]

      if (targetDistrict && targetDistrict.congestion < this.congestionLevel) {
        // Send redirection requests
        for (const vehicle of vehicles) {
          await this.sendMessage(
            `vehicle-${vehicle.vehicle_id}`,
            'info',
            {
              type: 'redirection-request',
              targetDistrict: targetDistrict.districtId,
              reason: 'load_balancing',
              priority: 5
            }
          )
        }
      }
    }
  }

  private async prepareForIncomingVehicles() {
    // Notify local infrastructure
    console.log(`${this.districtConfig.name} preparing for incoming vehicles`)
    
    // Could implement charging station preparation, intersection optimization, etc.
  }

  private checkPathIntersection(path: Array<[number, number]>): boolean {
    // Simplified intersection check - would use proper geometric algorithms
    return path.some(point => this.pointInDistrict(point))
  }

  private pointInDistrict(point: [number, number]): boolean {
    // Simplified point-in-polygon test
    const [lng, lat] = point
    const center = this.districtConfig.center
    const distance = Math.sqrt(
      Math.pow(lng - center.lng, 2) + Math.pow(lat - center.lat, 2)
    )
    return distance < 0.02 // Roughly 2km radius
  }

  private async redirectVehiclesFromCorridor(path: Array<[number, number]>) {
    console.log(`Redirecting vehicles from emergency corridor in ${this.districtConfig.name}`)
    
    // Implementation would calculate alternative routes
  }

  private calculateAverageSpeed(vehicles: VehicleState[]): number {
    if (vehicles.length === 0) return 0
    
    // Simplified - would calculate based on position changes over time
    const movingVehicles = vehicles.filter(v => v.status === 'enroute')
    return movingVehicles.length > 0 ? 25 : 0 // mph
  }
}

// Factory function to create all district agents
export function createDistrictAgents(): DistrictAgent[] {
  const districts: DistrictConfig[] = [
    {
      id: 'financial',
      name: 'Financial District',
      center: { lat: 37.7946, lng: -122.3999 },
      boundaries: [], // Would include actual boundary coordinates
      adjacentDistricts: ['soma', 'northbeach', 'chinatown'],
      capacity: 150,
      specialZones: ['business']
    },
    {
      id: 'soma',
      name: 'SOMA',
      center: { lat: 37.7785, lng: -122.4056 },
      boundaries: [],
      adjacentDistricts: ['financial', 'mission', 'tenderloin'],
      capacity: 200,
      specialZones: ['tech', 'business']
    },
    {
      id: 'mission',
      name: 'Mission',
      center: { lat: 37.7599, lng: -122.4148 },
      boundaries: [],
      adjacentDistricts: ['soma', 'castro', 'noevalley'],
      capacity: 180,
      specialZones: ['residential', 'cultural']
    },
    {
      id: 'castro',
      name: 'Castro',
      center: { lat: 37.7609, lng: -122.4350 },
      boundaries: [],
      adjacentDistricts: ['mission', 'haight', 'noevalley'],
      capacity: 120,
      specialZones: ['residential', 'tourist']
    },
    {
      id: 'haight',
      name: 'Haight-Ashbury',
      center: { lat: 37.7692, lng: -122.4481 },
      boundaries: [],
      adjacentDistricts: ['castro', 'richmond', 'sunset'],
      capacity: 100,
      specialZones: ['tourist', 'residential']
    },
    {
      id: 'richmond',
      name: 'Richmond',
      center: { lat: 37.7798, lng: -122.4836 },
      boundaries: [],
      adjacentDistricts: ['haight', 'sunset', 'presidio'],
      capacity: 160,
      specialZones: ['residential']
    },
    {
      id: 'sunset',
      name: 'Sunset',
      center: { lat: 37.7485, lng: -122.4945 },
      boundaries: [],
      adjacentDistricts: ['richmond', 'haight', 'westportal'],
      capacity: 180,
      specialZones: ['residential', 'school']
    },
    {
      id: 'marina',
      name: 'Marina',
      center: { lat: 37.8034, lng: -122.4363 },
      boundaries: [],
      adjacentDistricts: ['northbeach', 'pacific', 'presidio'],
      capacity: 140,
      specialZones: ['tourist', 'waterfront']
    },
    {
      id: 'northbeach',
      name: 'North Beach',
      center: { lat: 37.8060, lng: -122.4103 },
      boundaries: [],
      adjacentDistricts: ['financial', 'chinatown', 'marina'],
      capacity: 110,
      specialZones: ['tourist', 'cultural']
    },
    {
      id: 'chinatown',
      name: 'Chinatown',
      center: { lat: 37.7941, lng: -122.4078 },
      boundaries: [],
      adjacentDistricts: ['financial', 'northbeach', 'nobhill'],
      capacity: 90,
      specialZones: ['tourist', 'cultural']
    },
    {
      id: 'tenderloin',
      name: 'Tenderloin',
      center: { lat: 37.7847, lng: -122.4141 },
      boundaries: [],
      adjacentDistricts: ['soma', 'nobhill', 'civic'],
      capacity: 80,
      specialZones: ['restricted'] // Some AV companies avoid
    },
    {
      id: 'nobhill',
      name: 'Nob Hill',
      center: { lat: 37.7930, lng: -122.4161 },
      boundaries: [],
      adjacentDistricts: ['chinatown', 'tenderloin', 'pacific'],
      capacity: 100,
      specialZones: ['tourist', 'hotel']
    }
  ]

  return districts.map(config => new DistrictAgent(config))
}
