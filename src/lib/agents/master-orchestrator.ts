import { BaseAgent, Message } from './base-agent'
import { supabase } from '../supabase'
import { optimizeCityTraffic, routeEmergencyVehicle } from '../nvidia'
import { mapboxService } from '../mapbox'
import { broadcastCoordinationEvent, broadcastEmergency, broadcastSystemStatus } from '../event-broadcaster'
import type { VehicleState, SystemMetrics, Agent, FleetStatistics } from '../supabase'

interface DistrictCongestion {
  districtId: string
  congestionLevel: number
  vehicleCount: number
  avgWaitTime: number
}

export class MasterOrchestratorAgent extends BaseAgent {
  private districtAgents: string[] = []
  private fleetAgents: string[] = []
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    super({
      id: 'master-orchestrator',
      name: 'Master Orchestrator',
      type: 'master',
      priority: 100
    })
  }

  setupMessageHandlers(): void {
    this.messageHandlers.set('district-report', this.handleDistrictReport.bind(this))
    this.messageHandlers.set('emergency-alert', this.handleEmergencyAlert.bind(this))
    this.messageHandlers.set('congestion-alert', this.handleCongestionAlert.bind(this))
    this.messageHandlers.set('special-event', this.handleSpecialEvent.bind(this))
  }

  async processMessage(message: Message): Promise<void> {
    const handler = this.messageHandlers.get(message.payload.type)
    if (handler) {
      await handler(message)
    }
  }

  async makeDecision(context: any): Promise<any> {
    // Use NVIDIA Nemotron for city-wide optimization
    const trafficData = await this.collectCityWideData()
    const optimizationPlan = await optimizeCityTraffic({
      current_state: trafficData,
      context: context,
      optimization_goals: {
        reduce_congestion: true,
        maintain_fairness: true,
        minimize_wait_times: true
      }
    })

    return optimizationPlan
  }

  async start() {
    await super.start()
    
    // Initialize district and fleet agents from database
    await this.initializeAgents()
    
    // Start monitoring
    this.startCityMonitoring()
  }

  async stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    await super.stop()
  }

  private async initializeAgents() {
    // Load agents from database
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active')
      .returns<Agent[]>()

    if (agents) {
      // Filter district agents
      this.districtAgents = agents
        .filter(a => a.agent_type === 'district_coordinator')
        .map(a => a.agent_id)

      // Filter fleet agents
      this.fleetAgents = agents
        .filter(a => a.agent_type === 'fleet_coordinator')
        .map(a => a.agent_id)
      
      console.log(`Initialized ${this.districtAgents.length} district agents and ${this.fleetAgents.length} fleet agents from database`)
    }
  }

  private startCityMonitoring() {
    // Monitor city-wide metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.analyzeCityState()
    }, 30000)
  }

  private async analyzeCityState() {
    const congestionData = await this.getDistrictCongestion()
    
    // Check for hotspots
    const hotspots = congestionData.filter(d => d.congestionLevel > 0.7)
    
    if (hotspots.length > 0) {
      // Trigger load balancing
      await this.triggerLoadBalancing(hotspots)
    }

    // Update system metrics
    await this.updateSystemMetrics(congestionData)
  }

  private async getDistrictCongestion(): Promise<DistrictCongestion[]> {
    const districts = []
    
    for (const districtId of this.districtAgents) {
      // Get vehicle count and metrics for each district
      const { data: vehicles } = await supabase
        .from('vehicle_states')
        .select('*')
        .eq('anonymized_data->district', districtId)
        .gte('timestamp', new Date(Date.now() - 60000).toISOString())

      const vehicleCount = vehicles?.length || 0
      const avgWaitTime = vehicleCount > 0 && vehicles
        ? vehicles.reduce((acc, v) => {
            const waitTime = v.anonymized_data && 
              typeof v.anonymized_data === 'object' && 
              'wait_time' in v.anonymized_data 
              ? Number(v.anonymized_data.wait_time) 
              : 0
            return acc + waitTime
          }, 0) / vehicleCount
        : 0

      districts.push({
        districtId,
        congestionLevel: Math.min(vehicleCount / 100, 1), // Normalize to 0-1
        vehicleCount,
        avgWaitTime
      })
    }

    return districts
  }

  private async triggerLoadBalancing(hotspots: DistrictCongestion[]) {
    // Identify adjacent districts with lower congestion
    const balancingPlan = await this.makeDecision({
      type: 'load_balancing',
      hotspots,
      timestamp: new Date().toISOString()
    })

    // Send coordination messages to district agents
    for (const action of balancingPlan.actions || []) {
      await this.sendMessage(
        action.district,
        'info',
        {
          type: 'rebalancing-directive',
          action: action.instruction,
          priority: action.priority
        },
        8
      )
    }

    // Log coordination event
    await supabase.from('coordination_events').insert({
      event_type: 'congestion_mitigation',
      participants: hotspots.map(h => h.districtId),
      outcome: balancingPlan,
      metrics: {
        hotspot_count: hotspots.length,
        expected_improvement: balancingPlan.expected_improvement
      }
    })
  }

  private async handleDistrictReport(message: Message) {
    // Process district status reports
    const report = message.payload
    console.log(`District report from ${message.sender}:`, report)
    
    // Update district metrics in database
    await supabase.from('district_metrics').insert({
      district_name: message.sender.replace('district-', ''),
      vehicle_density: report.vehicle_count || 0,
      congestion_level: report.congestion_level || 0,
      average_speed: report.average_speed || 25,
      active_intersections: report.active_intersections || 0,
      coordination_score: report.coordination_score || 100
    })
  }

  private async handleEmergencyAlert(message: Message) {
    const emergency = message.payload
    
    // Use NVIDIA to calculate optimal corridor
    const routingPlan = await routeEmergencyVehicle({
      emergency_location: emergency.location,
      destination: emergency.destination,
      urgency: emergency.urgency,
      current_traffic: await this.collectCityWideData()
    })

    // Broadcast emergency corridor to all agents
    const allAgents = [...this.districtAgents, ...this.fleetAgents]
    await this.broadcast(
      allAgents,
      'emergency',
      {
        type: 'emergency-corridor',
        path: routingPlan.corridor_path,
        duration: routingPlan.estimated_duration,
        instructions: routingPlan.reroute_instructions
      },
      1000 // Maximum priority
    )

    // Log emergency event
    await supabase.from('coordination_events').insert({
      event_type: 'emergency_corridor',
      participants: allAgents,
      outcome: routingPlan,
      metrics: {
        time_saved: routingPlan.time_saved,
        vehicles_affected: routingPlan.affected_vehicles?.length || 0
      }
    })
  }

  private async handleCongestionAlert(message: Message) {
    const alert = message.payload
    console.log('Congestion alert:', alert)
    
    // Trigger immediate analysis and response
    await this.analyzeCityState()
  }

  private async handleSpecialEvent(message: Message) {
    const event = message.payload
    console.log('Special event notification:', event)
    
    // Prepare for increased traffic
    await this.sendMessage(
      'all-districts',
      'info',
      {
        type: 'special-event-prep',
        event: event.name,
        location: event.location,
        expected_surge: event.expectedSurge
      },
      7
    )
  }

  private async collectCityWideData() {
    const { data: vehicles } = await supabase
      .from('vehicle_states')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 120000).toISOString())
      .returns<VehicleState[]>()

    const { data: intersections } = await supabase
      .from('intersection_states')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())

    return {
      total_vehicles: vehicles?.length || 0,
      vehicle_distribution: this.calculateDistribution(vehicles || []),
      intersection_load: intersections || [],
      timestamp: new Date().toISOString()
    }
  }

  private calculateDistribution(vehicles: VehicleState[]) {
    const distribution: Record<string, number> = {}
    
    vehicles.forEach(v => {
      const district = v.anonymized_data.district || 'unknown'
      distribution[district] = (distribution[district] || 0) + 1
    })

    return distribution
  }

  private async updateSystemMetrics(congestionData: DistrictCongestion[]) {
    const totalVehicles = congestionData.reduce((sum, d) => sum + d.vehicleCount, 0)
    const avgCongestion = congestionData.reduce((sum, d) => sum + d.congestionLevel, 0) / congestionData.length
    const avgWaitReduction = 0.35 // Placeholder - would be calculated from actual data

    // Get recent coordination events
    const { data: events } = await supabase
      .from('coordination_events')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 60000).toISOString())

    const coordinationsPerMinute = events?.length || 0

    // Calculate fairness score
    const fairnessScore = await this.calculateFairnessScore()

    await supabase.from('system_metrics').insert({
      total_vehicles: totalVehicles,
      coordinations_per_minute: coordinationsPerMinute,
      average_wait_reduction: avgWaitReduction,
      fairness_score: fairnessScore,
      district_congestion_levels: Object.fromEntries(
        congestionData.map(d => [d.districtId, d.congestionLevel])
      )
    })
  }

  private async calculateFairnessScore(): Promise<number> {
    // Get fleet statistics
    const { data: fleetStats } = await supabase
      .from('fleet_statistics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString())
      .returns<FleetStatistics[]>()

    if (!fleetStats || fleetStats.length === 0) return 1.0

    // Group by company
    const companyStats = new Map<string, number[]>()
    fleetStats.forEach(stat => {
      if (!companyStats.has(stat.company)) {
        companyStats.set(stat.company, [])
      }
      companyStats.get(stat.company)!.push(stat.priority_score)
    })

    // Calculate variance in priority scores
    const avgScores = Array.from(companyStats.values()).map(
      scores => scores.reduce((a, b) => a + b, 0) / scores.length
    )

    const mean = avgScores.reduce((a, b) => a + b, 0) / avgScores.length
    const variance = avgScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / avgScores.length

    // Lower variance = higher fairness
    return Math.max(0, 1 - (variance / 100))
  }
}
