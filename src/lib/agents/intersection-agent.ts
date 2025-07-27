import { BaseAgent, Message } from './base-agent'
import { supabase } from '../supabase'
import { negotiateIntersection } from '../nvidia'
import type { VehicleState, IntersectionState } from '../supabase'

interface CrossingRequest {
  vehicleId: string
  company: string
  arrivalTime: number
  waitTime: number
  priority: number
  passengers: number
  batteryLevel: number
  direction: string
}

interface AuctionResult {
  crossingOrder: string[]
  waitTimes: Record<string, number>
  fairnessAdjustments: Record<string, number>
}

export class IntersectionAgent extends BaseAgent {
  private intersectionId: string
  private location: { lat: number; lng: number }
  private queuesByDirection: Map<string, CrossingRequest[]> = new Map()
  private currentNegotiations: Set<string> = new Set()
  private fairnessTracker: Map<string, number> = new Map()

  constructor(intersectionId: string, name: string, location: { lat: number; lng: number }) {
    super({
      id: `intersection-${intersectionId}`,
      name,
      type: 'intersection',
      priority: 50
    })
    this.intersectionId = intersectionId
    this.location = location
    this.initializeQueues()
  }

  setupMessageHandlers(): void {
    this.messageHandlers.set('crossing-request', this.handleCrossingRequest.bind(this))
    this.messageHandlers.set('emergency-preemption', this.handleEmergencyPreemption.bind(this))
    this.messageHandlers.set('status-query', this.handleStatusQuery.bind(this))
  }

  async processMessage(message: Message): Promise<void> {
    const handler = this.messageHandlers.get(message.payload.type)
    if (handler) {
      await handler(message)
    }
  }

  async makeDecision(context: any): Promise<any> {
    // Use NVIDIA Nemotron for complex intersection negotiations
    const intersectionData = {
      queues: Object.fromEntries(this.queuesByDirection),
      fairness_history: Object.fromEntries(this.fairnessTracker),
      current_time: Date.now(),
      traffic_conditions: context
    }

    return await negotiateIntersection(intersectionData)
  }

  private initializeQueues() {
    // Initialize queues for each direction
    const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest']
    directions.forEach(dir => {
      this.queuesByDirection.set(dir, [])
    })
  }

  private async handleCrossingRequest(message: Message) {
    const request: CrossingRequest = {
      vehicleId: message.payload.vehicleId,
      company: message.payload.company,
      arrivalTime: Date.now(),
      waitTime: 0,
      priority: this.calculatePriority(message.payload),
      passengers: message.payload.passengers || 0,
      batteryLevel: message.payload.batteryLevel || 100,
      direction: message.payload.direction
    }

    // Add to appropriate queue
    const queue = this.queuesByDirection.get(request.direction)
    if (queue) {
      queue.push(request)
      
      // Check if we should trigger negotiation
      if (this.shouldNegotiate()) {
        await this.runAuctionNegotiation()
      }
    }

    // Send acknowledgment
    await this.sendMessage(
      message.sender,
      'info',
      {
        type: 'crossing-request-ack',
        position: queue?.length || 0,
        estimatedWait: this.estimateWaitTime(request.direction)
      }
    )
  }

  private calculatePriority(payload: any): number {
    let priority = 0

    // Base priority on wait time (10 points per minute)
    priority += (payload.waitTime || 0) / 60 * 10

    // Passenger count bonus (5 points per passenger)
    priority += (payload.passengers || 0) * 5

    // Battery critical bonus (50 points if <20%)
    if (payload.batteryLevel < 20) {
      priority += 50
    }

    // Apply fairness penalty
    const companyPenalty = this.fairnessTracker.get(payload.company) || 0
    priority -= companyPenalty

    return Math.max(0, priority)
  }

  private shouldNegotiate(): boolean {
    // Negotiate when multiple directions have waiting vehicles
    let activeDirections = 0
    this.queuesByDirection.forEach(queue => {
      if (queue.length > 0) activeDirections++
    })
    return activeDirections >= 2 && this.currentNegotiations.size === 0
  }

  private async runAuctionNegotiation() {
    const negotiationId = `neg-${Date.now()}`
    this.currentNegotiations.add(negotiationId)

    try {
      // Collect all crossing requests
      const allRequests: CrossingRequest[] = []
      this.queuesByDirection.forEach(queue => {
        allRequests.push(...queue)
      })

      // Update wait times
      allRequests.forEach(req => {
        req.waitTime = (Date.now() - req.arrivalTime) / 1000
        req.priority = this.calculatePriority({
          ...req,
          waitTime: req.waitTime
        })
      })

      // Get AI-powered negotiation result
      const result = await this.makeDecision({
        requests: allRequests,
        intersection: this.intersectionId
      })

      // Execute crossing order
      await this.executeCrossingOrder(result)

      // Update fairness tracker
      this.updateFairnessScores(result)

      // Log the negotiation
      await supabase.from('coordination_events').insert({
        event_type: 'intersection_negotiation',
        participants: allRequests.map(r => r.vehicleId),
        outcome: result,
        metrics: {
          vehicles_coordinated: allRequests.length,
          average_wait_time: allRequests.reduce((sum, r) => sum + r.waitTime, 0) / allRequests.length
        }
      })

    } finally {
      this.currentNegotiations.delete(negotiationId)
    }
  }

  private async executeCrossingOrder(result: AuctionResult) {
    const { crossingOrder, waitTimes } = result

    for (const vehicleId of crossingOrder) {
      // Find and remove vehicle from queue
      let vehicleRequest: CrossingRequest | undefined
      let sourceQueue: CrossingRequest[] | undefined

      this.queuesByDirection.forEach(queue => {
        const index = queue.findIndex(r => r.vehicleId === vehicleId)
        if (index !== -1) {
          vehicleRequest = queue[index]
          sourceQueue = queue
          queue.splice(index, 1)
        }
      })

      if (vehicleRequest) {
        // Send crossing permission
        await this.sendMessage(
          `vehicle-${vehicleId}`,
          'info',
          {
            type: 'crossing-permission',
            intersection: this.intersectionId,
            waitTime: waitTimes[vehicleId] || 0,
            crossNow: true
          },
          10
        )
      }
    }
  }

  private updateFairnessScores(result: AuctionResult) {
    const { fairnessAdjustments } = result
    
    Object.entries(fairnessAdjustments).forEach(([company, adjustment]) => {
      const current = this.fairnessTracker.get(company) || 0
      this.fairnessTracker.set(company, current + adjustment)
    })

    // Decay fairness penalties over time
    this.fairnessTracker.forEach((value, company) => {
      this.fairnessTracker.set(company, value * 0.95)
    })
  }

  private async handleEmergencyPreemption(message: Message) {
    console.log('Emergency preemption received:', message.payload)

    // Clear all queues
    this.queuesByDirection.forEach(queue => {
      queue.forEach(async (request) => {
        await this.sendMessage(
          `vehicle-${request.vehicleId}`,
          'emergency',
          {
            type: 'emergency-yield',
            reason: 'emergency_vehicle',
            holdPosition: true
          },
          1000
        )
      })
      queue.length = 0 // Clear queue
    })

    // Update intersection state
    await this.updateIntersectionState({
      emergency_active: true,
      emergency_duration: message.payload.duration
    })
  }

  private async handleStatusQuery(message: Message) {
    const status = {
      intersection: this.intersectionId,
      location: this.location,
      queueLengths: Object.fromEntries(
        Array.from(this.queuesByDirection.entries()).map(([dir, queue]) => [dir, queue.length])
      ),
      totalWaiting: Array.from(this.queuesByDirection.values()).reduce((sum, q) => sum + q.length, 0),
      activeNegotiations: this.currentNegotiations.size,
      averageWaitTime: this.calculateAverageWaitTime()
    }

    await this.sendMessage(
      message.sender,
      'info',
      {
        type: 'status-response',
        status
      }
    )
  }

  private estimateWaitTime(direction: string): number {
    const queue = this.queuesByDirection.get(direction)
    if (!queue) return 0

    // Estimate based on queue position and historical data
    const position = queue.length
    const avgCrossingTime = 15 // seconds
    return position * avgCrossingTime
  }

  private calculateAverageWaitTime(): number {
    let totalWait = 0
    let totalVehicles = 0

    this.queuesByDirection.forEach(queue => {
      queue.forEach(request => {
        totalWait += (Date.now() - request.arrivalTime) / 1000
        totalVehicles++
      })
    })

    return totalVehicles > 0 ? totalWait / totalVehicles : 0
  }

  private async updateIntersectionState(additionalData: any = {}) {
    const state: Partial<IntersectionState> = {
      intersection_id: this.intersectionId,
      timestamp: new Date().toISOString(),
      queue_lengths: Object.fromEntries(
        Array.from(this.queuesByDirection.entries()).map(([dir, queue]) => [dir, queue.length])
      ),
      average_wait_time: this.calculateAverageWaitTime(),
      active_negotiations: Array.from(this.currentNegotiations),
      ...additionalData
    }

    await supabase
      .from('intersection_states')
      .upsert(state, { onConflict: 'intersection_id' })
  }

  async start() {
    await super.start()
    
    // Start periodic state updates
    setInterval(() => {
      this.updateIntersectionState()
    }, 10000) // Every 10 seconds
  }
}

// Factory function to create major intersection agents
export function createMajorIntersections(): IntersectionAgent[] {
  const intersections = [
    {
      id: 'vanness-market',
      name: 'Van Ness & Market',
      location: { lat: 37.7755, lng: -122.4194 }
    },
    {
      id: 'octavia-market',
      name: 'Octavia & Market',
      location: { lat: 37.7728, lng: -122.4244 }
    },
    {
      id: '4th-king',
      name: '4th & King',
      location: { lat: 37.7759, lng: -122.3948 }
    },
    {
      id: '19th-lincoln',
      name: '19th Ave & Lincoln',
      location: { lat: 37.7654, lng: -122.4775 }
    },
    {
      id: 'columbus-broadway',
      name: 'Columbus & Broadway',
      location: { lat: 37.7977, lng: -122.4066 }
    }
  ]

  return intersections.map(config => 
    new IntersectionAgent(config.id, config.name, config.location)
  )
}
