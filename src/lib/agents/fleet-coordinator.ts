import { BaseAgent, Message } from './base-agent'
import { supabase } from '../supabase'
import type { VehicleState, FleetStatistics } from '../supabase'

interface FleetConfig {
  company: 'waymo' | 'zoox' | 'cruise'
  primaryColor: string
  depotLocations: Array<{ lat: number; lng: number }>
  fleetSize: number
  privacyLevel: 'minimal' | 'standard' | 'cooperative'
  routingPreferences: {
    avoidDistricts?: string[]
    preferredCharging?: string[]
    maxDetourTime?: number
  }
}

interface VehicleInfo {
  id: string
  status: VehicleState['status']
  batteryLevel: number
  passengerCount: number
  gridPosition: [number, number]
  currentDistrict: string
  waitTime: number
}

export class FleetCoordinatorAgent extends BaseAgent {
  private fleetConfig: FleetConfig
  private activeVehicles: Map<string, VehicleInfo> = new Map()
  private priorityScore: number = 50
  private recentCoordinations: number = 0

  constructor(config: FleetConfig) {
    super({
      id: `fleet-${config.company}`,
      name: `Fleet Coordinator - ${config.company.toUpperCase()}`,
      type: 'fleet',
      priority: 80
    })
    this.fleetConfig = config
  }

  setupMessageHandlers(): void {
    this.messageHandlers.set('coordination-proposal', this.handleCoordinationProposal.bind(this))
    this.messageHandlers.set('emergency-corridor', this.handleEmergencyCorridor.bind(this))
    this.messageHandlers.set('rebalancing-request', this.handleRebalancingRequest.bind(this))
    this.messageHandlers.set('fleet-status-query', this.handleFleetStatusQuery.bind(this))
    this.messageHandlers.set('privacy-negotiation', this.handlePrivacyNegotiation.bind(this))
  }

  async processMessage(message: Message): Promise<void> {
    const handler = this.messageHandlers.get(message.payload.type)
    if (handler) {
      await handler(message)
    }
  }

  async makeDecision(context: any): Promise<any> {
    // Fleet-level decision making
    const decision = {
      action: '',
      vehicles: [] as string[],
      reasoning: ''
    }

    switch (context.type) {
      case 'rebalancing':
        decision.action = 'redistribute'
        decision.vehicles = this.selectVehiclesForRebalancing(context.targetDistrict, context.count)
        decision.reasoning = `Moving ${decision.vehicles.length} vehicles to ${context.targetDistrict}`
        break
      
      case 'emergency_response':
        decision.action = 'clear_path'
        decision.vehicles = this.getVehiclesInPath(context.path)
        decision.reasoning = 'Clearing emergency corridor'
        break
      
      case 'coordination':
        decision.action = this.evaluateCoordinationProposal(context.proposal) ? 'accept' : 'reject'
        decision.reasoning = this.getCoordinationReasoning(context.proposal)
        break
    }

    return decision
  }

  async start() {
    await super.start()
    
    // Initialize fleet monitoring
    setInterval(() => this.updateFleetStatus(), 10000)
    
    // Update priority scores
    setInterval(() => this.updatePriorityScore(), 60000)
  }

  private async handleCoordinationProposal(message: Message) {
    const proposal = message.payload.proposal
    
    // Check privacy constraints
    if (!this.meetsPrivacyRequirements(proposal)) {
      await this.sendMessage(
        message.sender,
        'rejection',
        {
          proposalId: message.payload.proposalId,
          reason: 'privacy_constraint',
          alternativeProposal: this.generatePrivacyCompliantAlternative(proposal)
        }
      )
      return
    }

    // Evaluate proposal
    const decision = await this.makeDecision({
      type: 'coordination',
      proposal
    })

    if (decision.action === 'accept') {
      await this.sendMessage(
        message.sender,
        'acceptance',
        {
          proposalId: message.payload.proposalId,
          commitment: this.generateCommitment(proposal)
        }
      )
      
      // Execute coordination
      await this.executeCoordination(proposal)
      this.recentCoordinations++
    } else {
      await this.sendMessage(
        message.sender,
        'rejection',
        {
          proposalId: message.payload.proposalId,
          reason: decision.reasoning
        }
      )
    }
  }

  private async handleEmergencyCorridor(message: Message) {
    const { path, duration, instructions } = message.payload
    
    console.log(`${this.fleetConfig.company}: Emergency corridor request received`)
    
    // Identify affected vehicles
    const affectedVehicles = this.getVehiclesInPath(path)
    
    // Send yield instructions to vehicles
    for (const vehicleId of affectedVehicles) {
      await this.sendMessage(
        `vehicle-${vehicleId}`,
        'emergency',
        {
          type: 'emergency-yield',
          instructions: instructions[vehicleId] || 'pull_over',
          duration
        },
        1000
      )
    }

    // Update fleet state
    await this.updateFleetEmergencyStatus(affectedVehicles, true)
  }

  private async handleRebalancingRequest(message: Message) {
    const { fromDistrict, toDistrict, vehicleCount } = message.payload
    
    // Select vehicles for rebalancing
    const selectedVehicles = this.selectVehiclesForRebalancing(toDistrict, vehicleCount)
    
    if (selectedVehicles.length > 0) {
      // Send rebalancing instructions
      for (const vehicleId of selectedVehicles) {
        await this.sendMessage(
          `vehicle-${vehicleId}`,
          'info',
          {
            type: 'rebalance-directive',
            targetDistrict: toDistrict,
            reason: 'load_balancing'
          }
        )
      }

      await this.sendMessage(
        message.sender,
        'info',
        {
          type: 'rebalancing-ack',
          vehiclesRebalanced: selectedVehicles.length,
          expectedArrival: this.estimateArrivalTime(fromDistrict, toDistrict)
        }
      )
    }
  }

  private async handleFleetStatusQuery(message: Message) {
    const status = await this.getFleetStatus()
    
    await this.sendMessage(
      message.sender,
      'info',
      {
        type: 'fleet-status-response',
        company: this.fleetConfig.company,
        status: this.sanitizeFleetStatus(status, message.payload.requesterType)
      }
    )
  }

  private async handlePrivacyNegotiation(message: Message) {
    const { requestedLevel, duration, purpose } = message.payload
    
    // Evaluate privacy level change request
    const canElevate = this.evaluatePrivacyElevation(requestedLevel, purpose)
    
    if (canElevate) {
      // Temporarily elevate privacy level
      const originalLevel = this.fleetConfig.privacyLevel
      this.fleetConfig.privacyLevel = requestedLevel
      
      setTimeout(() => {
        this.fleetConfig.privacyLevel = originalLevel
      }, duration * 1000)
      
      await this.sendMessage(
        message.sender,
        'info',
        {
          type: 'privacy-elevation-granted',
          newLevel: requestedLevel,
          duration
        }
      )
    } else {
      await this.sendMessage(
        message.sender,
        'info',
        {
          type: 'privacy-elevation-denied',
          reason: 'business_sensitive'
        }
      )
    }
  }

  private async updateFleetStatus() {
    // Get all vehicles for this company
    const { data: vehicles } = await supabase
      .from('vehicle_states')
      .select('*')
      .eq('company', this.fleetConfig.company)
      .gte('timestamp', new Date(Date.now() - 120000).toISOString())

    // Update internal state
    this.activeVehicles.clear()
    const vehicleStates = (vehicles || []) as unknown as VehicleState[]
    vehicleStates.forEach(v => {
      this.activeVehicles.set(v.vehicle_id, {
        id: v.vehicle_id,
        status: v.status,
        batteryLevel: v.battery_level || 100,
        passengerCount: v.passenger_count || 0,
        gridPosition: v.grid_position.coordinates as [number, number],
        currentDistrict: (v.anonymized_data as any)?.district || 'unknown',
        waitTime: (v.anonymized_data as any)?.wait_time || 0
      })
    })

    // Calculate and store fleet statistics
    const stats = this.calculateFleetStatistics()
    await supabase.from('fleet_statistics').insert({
      company: this.fleetConfig.company,
      active_vehicles: stats.activeCount,
      idle_vehicles: stats.idleCount,
      passenger_miles: stats.passengerMiles,
      average_wait_time: stats.avgWaitTime,
      priority_score: this.priorityScore
    })
  }

  private calculateFleetStatistics() {
    let activeCount = 0
    let idleCount = 0
    let totalWaitTime = 0
    let passengerMiles = 0

    this.activeVehicles.forEach(vehicle => {
      if (vehicle.status === 'idle') {
        idleCount++
      } else {
        activeCount++
      }
      totalWaitTime += vehicle.waitTime
      // Simplified passenger miles calculation
      if (vehicle.status === 'enroute' && vehicle.passengerCount > 0) {
        passengerMiles += 0.1 // Would calculate based on actual distance
      }
    })

    return {
      activeCount,
      idleCount,
      passengerMiles,
      avgWaitTime: this.activeVehicles.size > 0 ? totalWaitTime / this.activeVehicles.size : 0
    }
  }

  private updatePriorityScore() {
    // Adjust priority based on recent coordination participation
    if (this.recentCoordinations > 5) {
      this.priorityScore = Math.max(0, this.priorityScore - 5)
    } else if (this.recentCoordinations < 2) {
      this.priorityScore = Math.min(100, this.priorityScore + 2)
    }
    
    // Reset coordination counter
    this.recentCoordinations = 0
  }

  private meetsPrivacyRequirements(proposal: any): boolean {
    // Check if proposal respects privacy constraints
    switch (this.fleetConfig.privacyLevel) {
      case 'minimal':
        return !proposal.requiresRouteSharing && !proposal.requiresPassengerInfo
      case 'standard':
        return !proposal.requiresFullRoute
      case 'cooperative':
        return true
      default:
        return false
    }
  }

  private generatePrivacyCompliantAlternative(proposal: any): any {
    // Generate alternative that meets privacy requirements
    return {
      ...proposal,
      requiresRouteSharing: false,
      requiresPassengerInfo: false,
      dataSharing: this.fleetConfig.privacyLevel
    }
  }

  private evaluateCoordinationProposal(proposal: any): boolean {
    // Business logic to evaluate proposals
    if (proposal.expectedBenefit < 0) return false
    if (proposal.affectedVehicles > this.activeVehicles.size * 0.5) return false
    if (this.priorityScore < 30 && proposal.priority < 8) return false
    
    return true
  }

  private getCoordinationReasoning(proposal: any): string {
    if (proposal.expectedBenefit < 0) {
      return 'Negative expected benefit'
    }
    if (proposal.affectedVehicles > this.activeVehicles.size * 0.5) {
      return 'Too many vehicles affected'
    }
    return 'Proposal accepted'
  }

  private generateCommitment(proposal: any): any {
    return {
      vehicles: this.selectVehiclesForCoordination(proposal),
      duration: proposal.duration,
      actions: proposal.requestedActions
    }
  }

  private selectVehiclesForCoordination(proposal: any): string[] {
    const vehicles: string[] = []
    const requiredCount = proposal.requiredVehicles || 5

    this.activeVehicles.forEach((vehicle, id) => {
      if (vehicles.length < requiredCount && 
          vehicle.status === 'idle' &&
          vehicle.currentDistrict === proposal.district) {
        vehicles.push(id)
      }
    })

    return vehicles
  }

  private async executeCoordination(proposal: any) {
    console.log(`${this.fleetConfig.company}: Executing coordination ${proposal.id}`)
    // Implementation would send specific instructions to vehicles
  }

  private getVehiclesInPath(path: Array<[number, number]>): string[] {
    const affectedVehicles: string[] = []
    const pathBuffer = 0.001 // ~100m buffer around path

    this.activeVehicles.forEach((vehicle, id) => {
      // Check if vehicle is near the path
      const [vLng, vLat] = vehicle.gridPosition
      const nearPath = path.some(([pLng, pLat]) => {
        const distance = Math.sqrt(
          Math.pow(vLng - pLng, 2) + Math.pow(vLat - pLat, 2)
        )
        return distance < pathBuffer
      })

      if (nearPath) {
        affectedVehicles.push(id)
      }
    })

    return affectedVehicles
  }

  private selectVehiclesForRebalancing(targetDistrict: string, count: number): string[] {
    const candidates: string[] = []

    this.activeVehicles.forEach((vehicle, id) => {
      if (candidates.length < count &&
          vehicle.status === 'idle' &&
          vehicle.passengerCount === 0 &&
          !this.fleetConfig.routingPreferences.avoidDistricts?.includes(targetDistrict)) {
        candidates.push(id)
      }
    })

    return candidates
  }

  private async updateFleetEmergencyStatus(vehicleIds: string[], emergency: boolean) {
    // Update vehicle states to reflect emergency status
    for (const vehicleId of vehicleIds) {
      const vehicle = this.activeVehicles.get(vehicleId)
      if (vehicle) {
        vehicle.status = emergency ? 'emergency_yield' : 'idle'
      }
    }
  }

  private estimateArrivalTime(from: string, to: string): number {
    // Simplified - would use actual routing
    return 600 // 10 minutes
  }

  private async getFleetStatus() {
    const stats = this.calculateFleetStatistics()
    return {
      totalVehicles: this.fleetConfig.fleetSize,
      activeVehicles: stats.activeCount,
      idleVehicles: stats.idleCount,
      chargingVehicles: Array.from(this.activeVehicles.values())
        .filter(v => v.status === 'charging').length,
      avgBatteryLevel: this.calculateAvgBatteryLevel(),
      districtsServed: this.getUniqueDistricts(),
      priorityScore: this.priorityScore
    }
  }

  private sanitizeFleetStatus(status: any, requesterType: string): any {
    // Remove sensitive information based on requester type and privacy level
    if (this.fleetConfig.privacyLevel === 'minimal') {
      return {
        company: this.fleetConfig.company,
        activeVehicles: status.activeVehicles,
        districtsServed: status.districtsServed.length
      }
    }

    return status
  }

  private evaluatePrivacyElevation(requestedLevel: string, purpose: string): boolean {
    // Only allow elevation for emergencies or city-mandated coordination
    return purpose === 'emergency' || purpose === 'city_mandate'
  }

  private calculateAvgBatteryLevel(): number {
    let totalBattery = 0
    let count = 0

    this.activeVehicles.forEach(vehicle => {
      totalBattery += vehicle.batteryLevel
      count++
    })

    return count > 0 ? totalBattery / count : 100
  }

  private getUniqueDistricts(): string[] {
    const districts = new Set<string>()
    this.activeVehicles.forEach(vehicle => {
      districts.add(vehicle.currentDistrict)
    })
    return Array.from(districts)
  }
}

// Factory function to create fleet coordinator agents
export function createFleetCoordinators(): FleetCoordinatorAgent[] {
  const fleetConfigs: FleetConfig[] = [
    {
      company: 'waymo',
      primaryColor: '#4285F4',
      depotLocations: [
        { lat: 37.7749, lng: -122.4194 }, // SOMA
        { lat: 37.7599, lng: -122.4148 }  // Mission
      ],
      fleetSize: 250,
      privacyLevel: 'cooperative',
      routingPreferences: {
        preferredCharging: ['soma', 'mission'],
        maxDetourTime: 300
      }
    },
    {
      company: 'zoox',
      primaryColor: '#00A86B',
      depotLocations: [
        { lat: 37.7785, lng: -122.3948 }, // South Beach
        { lat: 37.7609, lng: -122.4350 }  // Castro
      ],
      fleetSize: 200,
      privacyLevel: 'standard',
      routingPreferences: {
        avoidDistricts: ['tenderloin'],
        preferredCharging: ['soma', 'castro'],
        maxDetourTime: 240
      }
    },
    {
      company: 'cruise',
      primaryColor: '#FF6F00',
      depotLocations: [
        { lat: 37.7798, lng: -122.4836 }, // Richmond
        { lat: 37.7485, lng: -122.4945 }  // Sunset
      ],
      fleetSize: 300,
      privacyLevel: 'standard',
      routingPreferences: {
        avoidDistricts: ['tenderloin'],
        preferredCharging: ['richmond', 'sunset'],
        maxDetourTime: 360
      }
    }
  ]

  return fleetConfigs.map(config => new FleetCoordinatorAgent(config))
}
