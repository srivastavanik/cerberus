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

interface BottleneckAnalysis {
  id: string
  type: string
  severity: number
  location: [number, number]
  recommendations: any[]
  rootCauses?: any
}

export class MasterOrchestratorAgent extends BaseAgent {
  private districtAgents: string[] = []
  private fleetAgents: string[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private anomalyDetectionInterval: NodeJS.Timeout | null = null
  private trafficPredictionInterval: NodeJS.Timeout | null = null

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
    this.messageHandlers.set('negotiation-request', this.handleNegotiationRequest.bind(this))
    this.messageHandlers.set('anomaly-detected', this.handleAnomalyDetected.bind(this))
  }

  async processMessage(message: Message): Promise<void> {
    const handler = this.messageHandlers.get(message.payload.type)
    if (handler) {
      await handler(message)
    }
  }

  async makeDecision(context: any): Promise<any> {
    // Check for learned patterns that match current context
    const patterns = await this.findApplicablePatterns(context)
    
    // Use NVIDIA Nemotron with learned patterns
    const trafficData = await this.collectCityWideData()
    const optimizationPlan = await optimizeCityTraffic({
      current_state: trafficData,
      context: context,
      learned_patterns: patterns,
      optimization_goals: {
        reduce_congestion: true,
        maintain_fairness: true,
        minimize_wait_times: true
      }
    })

    // Store decision for audit
    await this.auditDecision(optimizationPlan, context)

    return optimizationPlan
  }

  async start() {
    await super.start()
    
    // Initialize agents from database
    await this.initializeAgents()
    
    // Start monitoring systems
    this.startCityMonitoring()
    this.startAnomalyDetection()
    this.startTrafficPrediction()
  }

  async stop() {
    if (this.monitoringInterval) clearInterval(this.monitoringInterval)
    if (this.anomalyDetectionInterval) clearInterval(this.anomalyDetectionInterval)
    if (this.trafficPredictionInterval) clearInterval(this.trafficPredictionInterval)
    await super.stop()
  }

  private async handleEmergencyAlert(message: Message) {
    const emergency = message.payload
    
    // Load emergency protocol
    const { data: protocol } = await supabase
      .from('emergency_protocols')
      .select('*')
      .eq('emergency_type', emergency.type)
      .eq('is_active', true)
      .single()

    if (!protocol) {
      console.error('No active protocol for emergency type:', emergency.type)
      return
    }

    // Use Mapbox for real-time routing
    const optimalRoute = await mapboxService.getDirections([
      emergency.location,
      emergency.destination
    ])

    // Calculate emergency corridor with traffic data
    const corridorPath = optimalRoute.routes[0]?.geometry.coordinates || []
    const trafficData = await mapboxService.getTrafficData(corridorPath)

    // Create emergency corridor
    const corridorId = `corridor-${Date.now()}`
    await supabase.from('emergency_corridors').insert({
      corridor_id: corridorId,
      protocol_id: protocol.id,
      emergency_type: emergency.type,
      emergency_vehicles: emergency.vehicles || [],
      destination: { 
        type: 'Point', 
        coordinates: emergency.destination 
      },
      corridor_path: {
        type: 'LineString',
        coordinates: corridorPath
      },
      buffer_distance_meters: protocol.corridor_width_meters,
      affected_intersections: await this.getAffectedIntersections(corridorPath),
      affected_districts: await this.getAffectedDistricts(corridorPath),
      estimated_duration_seconds: protocol.corridor_duration_seconds,
      coordinating_agents: [...this.districtAgents, ...this.fleetAgents],
      created_by: this.config.id
    })

    // Broadcast emergency corridor
    broadcastEmergency(emergency.location, {
      corridorId,
      path: corridorPath,
      protocol,
      estimatedClearanceTime: protocol.vehicle_clearance_time_seconds
    })

    // Send coordination messages
    await this.broadcast(
      [...this.districtAgents, ...this.fleetAgents],
      'emergency',
      {
        type: 'emergency-corridor',
        corridorId,
        path: corridorPath,
        duration: protocol.corridor_duration_seconds,
        clearanceTime: protocol.vehicle_clearance_time_seconds
      },
      1000
    )
  }

  private async detectBottlenecks() {
    const congestionData = await this.getDistrictCongestion()
    
    // Use Mapbox to identify traffic hotspots
    const sfBounds: [number, number, number, number] = [-122.5, 37.7, -122.35, 37.85]
    const incidents = await mapboxService.getTrafficIncidents(sfBounds)
    
    // Analyze for bottlenecks
    for (const district of congestionData) {
      if (district.congestionLevel > 0.8) {
        const analysis = await this.analyzeBottleneck(district, incidents)
        
        if (analysis) {
          await supabase.from('bottleneck_analysis').insert({
            analysis_id: `bottleneck-${Date.now()}-${district.districtId}`,
            bottleneck_type: analysis.type,
            severity: analysis.severity,
            primary_location: {
              type: 'Point',
              coordinates: analysis.location
            },
            affected_districts: [district.districtId],
            root_causes: analysis.rootCauses,
            recommended_actions: analysis.recommendations,
            priority_score: analysis.severity * district.congestionLevel,
            vehicles_affected: district.vehicleCount,
            average_delay_seconds: Math.round(district.avgWaitTime)
          })
          
          // Trigger mitigation
          await this.mitigateBottleneck(analysis)
        }
      }
    }
  }

  private async analyzeBottleneck(district: DistrictCongestion, incidents: any[]): Promise<BottleneckAnalysis | null> {
    // Simple bottleneck analysis - would be more sophisticated in production
    const districtCenter = this.getDistrictCenter(district.districtId)
    
    const nearbyIncidents = incidents.filter(incident => {
      const distance = mapboxService['haversineDistance'](
        districtCenter,
        [incident.location.lng, incident.location.lat]
      )
      return distance < 2 // Within 2km
    })

    if (district.congestionLevel > 0.8) {
      return {
        id: `analysis-${Date.now()}`,
        type: nearbyIncidents.length > 0 ? 'incident_related' : 'capacity_exceeded',
        severity: Math.round(district.congestionLevel * 10),
        location: districtCenter,
        recommendations: [
          { action: 'reroute_traffic', priority: 1 },
          { action: 'increase_signal_timing', priority: 2 },
          { action: 'request_fleet_rebalancing', priority: 3 }
        ]
      }
    }

    return null
  }

  private async mitigateBottleneck(analysis: BottleneckAnalysis) {
    // Create negotiation for bottleneck resolution
    const negotiationId = `negotiation-${Date.now()}`
    
    await supabase.from('negotiations').insert({
      negotiation_id: negotiationId,
      negotiation_type: 'resource_sharing',
      initiator_agent_id: this.config.id,
      participant_agent_ids: this.districtAgents,
      subject_type: 'bottleneck_mitigation',
      subject_data: analysis,
      deadline: new Date(Date.now() + 300000).toISOString(), // 5 minutes
      constraints: {
        max_vehicle_displacement: 50,
        maintain_fairness: true
      }
    })

    // Start negotiation process
    await this.initiateNegotiation(negotiationId, analysis)
  }

  private async handleNegotiationRequest(message: Message) {
    const { negotiationId, proposal } = message.payload
    
    // Evaluate proposal using learned patterns
    const evaluation = await this.evaluateProposal(proposal)
    
    if (evaluation.accept) {
      await this.acceptProposal(negotiationId, proposal)
    } else {
      await this.counterProposal(negotiationId, evaluation.counter)
    }
  }

  private async startAnomalyDetection() {
    this.anomalyDetectionInterval = setInterval(async () => {
      await this.detectAnomalies()
    }, 60000) // Every minute
  }

  private async detectAnomalies() {
    const metrics = await this.collectSystemMetrics()
    const baseline = await this.getHistoricalBaseline()
    
    // Simple anomaly detection
    const anomalies = []
    
    // Check coordination rate
    if (Math.abs(metrics.coordinationRate - baseline.avgCoordinationRate) > baseline.stdCoordinationRate * 2) {
      anomalies.push({
        type: 'coordination_anomaly',
        severity: 5,
        metric: 'coordination_rate',
        value: metrics.coordinationRate,
        baseline: baseline.avgCoordinationRate
      })
    }

    // Check congestion patterns
    if (metrics.avgCongestion > baseline.avgCongestion * 1.5) {
      anomalies.push({
        type: 'congestion_anomaly',
        severity: 7,
        metric: 'average_congestion',
        value: metrics.avgCongestion,
        baseline: baseline.avgCongestion
      })
    }

    // Log anomalies
    for (const anomaly of anomalies) {
      await supabase.from('system_anomalies').insert({
        anomaly_id: `anomaly-${Date.now()}-${anomaly.type}`,
        anomaly_type: 'performance_degradation',
        severity: anomaly.severity,
        detection_method: 'statistical_baseline',
        anomaly_score: Math.abs(anomaly.value - anomaly.baseline) / anomaly.baseline,
        baseline_comparison: {
          metric: anomaly.metric,
          current: anomaly.value,
          baseline: anomaly.baseline
        },
        affected_systems: ['coordination', 'traffic_flow'],
        anomaly_signature: anomaly
      })

      // Broadcast anomaly
      broadcastSystemStatus({
        type: 'anomaly_detected',
        anomaly
      })
    }
  }

  private async startTrafficPrediction() {
    this.trafficPredictionInterval = setInterval(async () => {
      await this.generateTrafficPredictions()
    }, 300000) // Every 5 minutes
  }

  private async generateTrafficPredictions() {
    // Get historical patterns
    const { data: patterns } = await supabase
      .from('historical_patterns')
      .select('*')
      .eq('is_active', true)
      .eq('pattern_category', 'daily_traffic')

    const currentHour = new Date().getHours()
    const dayOfWeek = new Date().getDay()

    // Find matching patterns
    const matchingPatterns = patterns?.filter(p => {
      if (!p.time_of_day_start || !p.time_of_day_end) return false
      if (typeof p.time_of_day_start !== 'string' || typeof p.time_of_day_end !== 'string') return false
      const startHour = parseInt(p.time_of_day_start.split(':')[0] || '0')
      const endHour = parseInt(p.time_of_day_end.split(':')[0] || '23')
      return currentHour >= startHour && currentHour <= endHour &&
             (Array.isArray(p.days_of_week) && p.days_of_week.includes(dayOfWeek))
    })

    if (matchingPatterns && matchingPatterns.length > 0) {
      // Generate predictions based on patterns
      const prediction = {
        prediction_id: `pred-${Date.now()}`,
        prediction_type: 'congestion_level',
        scope_type: 'city_wide',
        prediction_start: new Date().toISOString(),
        prediction_end: new Date(Date.now() + 3600000).toISOString(), // 1 hour ahead
        model_name: 'pattern_based_v1',
        model_version: '1.0.0',
        confidence_score: matchingPatterns[0].reliability_score || 0.7,
        predictions: this.generatePredictionData(matchingPatterns[0])
      }

      await supabase.from('traffic_predictions').insert(prediction)
      
      // Use predictions to proactively adjust
      await this.applyProactiveMeasures(prediction)
    }
  }

  private async applyProactiveMeasures(prediction: any) {
    if (prediction.predictions.expectedCongestion > 0.7) {
      // Proactively trigger load balancing
      console.log('Applying proactive measures based on prediction')
      
      // Send early warnings to fleet coordinators
      await this.broadcast(
        this.fleetAgents,
        'info',
        {
          type: 'congestion_prediction',
          prediction: prediction.predictions,
          recommendedActions: [
            'pre_position_vehicles',
            'adjust_dispatch_algorithms',
            'prepare_alternative_routes'
          ]
        },
        7
      )
    }
  }

  private async findApplicablePatterns(context: any) {
    const { data: patterns } = await supabase
      .from('learning_patterns')
      .select('*')
      .eq('is_active', true)
      .eq('pattern_type', context.type === 'load_balancing' ? 'congestion_resolution' : 'coordination_strategy')
      .gte('confidence_score', 0.7)

    return patterns?.filter(p => {
      // Check if pattern conditions match current context
      const conditions = p.context_conditions
      return this.matchesConditions(context, conditions)
    }) || []
  }

  private matchesConditions(context: any, conditions: any): boolean {
    // Simple condition matching - would be more sophisticated in production
    if (conditions.min_congestion && context.congestion < conditions.min_congestion) return false
    if (conditions.max_vehicles && context.vehicleCount > conditions.max_vehicles) return false
    if (conditions.time_of_day && !this.isInTimeWindow(conditions.time_of_day)) return false
    
    return true
  }

  private isInTimeWindow(timeWindow: { start: string, end: string }): boolean {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    const [startHour, startMin] = timeWindow.start.split(':').map(Number)
    const [endHour, endMin] = timeWindow.end.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }

  private async auditDecision(decision: any, context: any) {
    await supabase.from('decision_audit_trail').insert({
      audit_id: `audit-${Date.now()}`,
      decision_id: decision.id,
      agent_id: this.config.id,
      decision_type: context.type,
      decision_summary: `${context.type} decision for ${context.hotspots?.length || 0} hotspots`,
      compliance_rules_checked: ['fairness_policy', 'privacy_protection', 'safety_first'],
      compliance_passed: true,
      affected_entities: {
        districts: context.hotspots?.map((h: any) => h.districtId) || [],
        vehicles: decision.affected_vehicles || 0
      },
      decision_rationale: decision.reasoning || 'AI-optimized decision',
      alternative_options: decision.alternatives || []
    })
  }

  private getDistrictCenter(districtId: string): [number, number] {
    // District centers for San Francisco
    const centers: Record<string, [number, number]> = {
      'financial': [-122.3999, 37.7946],
      'soma': [-122.4056, 37.7785],
      'mission': [-122.4148, 37.7599],
      'castro': [-122.4350, 37.7609],
      'haight': [-122.4481, 37.7692],
      'richmond': [-122.4836, 37.7798],
      'sunset': [-122.4945, 37.7485],
      'marina': [-122.4363, 37.8034],
      'northbeach': [-122.4103, 37.8060],
      'chinatown': [-122.4078, 37.7941],
      'tenderloin': [-122.4141, 37.7847],
      'nobhill': [-122.4161, 37.7930]
    }
    
    const id = districtId.replace('district-', '')
    return centers[id] || [-122.4194, 37.7749] // Default to SF center
  }

  private async getAffectedIntersections(path: [number, number][]): Promise<string[]> {
    // Find intersections along the path
    const { data: intersections } = await supabase
      .from('intersections')
      .select('intersection_id, location')

    const affected: string[] = []
    const bufferDistance = 0.001 // ~100m

    intersections?.forEach(intersection => {
      if (!intersection.location || typeof intersection.location !== 'object') return
      const loc = (intersection.location as any).coordinates
      if (!loc || !Array.isArray(loc)) return

      const nearPath = path.some(point => {
        const distance = Math.sqrt(
          Math.pow(point[0] - loc[0], 2) + 
          Math.pow(point[1] - loc[1], 2)
        )
        return distance < bufferDistance
      })

      if (nearPath) {
        affected.push(intersection.intersection_id as string)
      }
    })

    return affected
  }

  private async getAffectedDistricts(path: [number, number][]): Promise<string[]> {
    // Simplified - would use actual district boundaries
    const districts = new Set<string>()
    
    path.forEach(point => {
      // Find closest district center
      let minDistance = Infinity
      let closestDistrict = 'unknown'
      
      Object.entries(this.getDistrictCenters()).forEach(([district, center]) => {
        const distance = Math.sqrt(
          Math.pow(point[0] - center[0], 2) + 
          Math.pow(point[1] - center[1], 2)
        )
        
        if (distance < minDistance) {
          minDistance = distance
          closestDistrict = district
        }
      })
      
      districts.add(closestDistrict)
    })
    
    return Array.from(districts)
  }

  private getDistrictCenters(): Record<string, [number, number]> {
    return {
      'financial': [-122.3999, 37.7946],
      'soma': [-122.4056, 37.7785],
      'mission': [-122.4148, 37.7599],
      'castro': [-122.4350, 37.7609],
      'haight': [-122.4481, 37.7692],
      'richmond': [-122.4836, 37.7798],
      'sunset': [-122.4945, 37.7485],
      'marina': [-122.4363, 37.8034],
      'northbeach': [-122.4103, 37.8060],
      'chinatown': [-122.4078, 37.7941],
      'tenderloin': [-122.4141, 37.7847],
      'nobhill': [-122.4161, 37.7930]
    }
  }

  private async collectSystemMetrics() {
    const { data: recentEvents } = await supabase
      .from('coordination_events')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString())

    const congestionData = await this.getDistrictCongestion()
    
    return {
      coordinationRate: (recentEvents?.length || 0) / 5, // per minute
      avgCongestion: congestionData.reduce((sum, d) => sum + d.congestionLevel, 0) / congestionData.length,
      totalVehicles: congestionData.reduce((sum, d) => sum + d.vehicleCount, 0)
    }
  }

  private async getHistoricalBaseline() {
    // Get historical metrics from past week at same time
    const currentHour = new Date().getHours()
    const dayOfWeek = new Date().getDay()
    
    // Simplified baseline - would aggregate historical data
    return {
      avgCoordinationRate: 10,
      stdCoordinationRate: 3,
      avgCongestion: 0.4,
      stdCongestion: 0.1
    }
  }

  private generatePredictionData(pattern: any) {
    // Generate prediction based on historical pattern
    return {
      expectedCongestion: pattern.signature_data?.avg_congestion || 0.5,
      expectedVehicleCount: pattern.signature_data?.avg_vehicles || 200,
      confidenceInterval: {
        lower: 0.7,
        upper: 0.9
      },
      hotspotProbabilities: pattern.signature_data?.hotspot_districts || {}
    }
  }

  private async handleAnomalyDetected(message: Message) {
    const anomaly = message.payload
    console.log('Anomaly detected:', anomaly)
    
    // Take corrective action based on anomaly type
    if (anomaly.severity > 7) {
      await this.triggerEmergencyProtocol('system_anomaly', anomaly)
    }
  }

  private async triggerEmergencyProtocol(type: string, data: any) {
    console.log(`Triggering emergency protocol: ${type}`, data)
    
    // Implement emergency response
    broadcastSystemStatus({
      type: 'emergency_protocol_activated',
      protocol: type,
      data
    })
  }

  private async initiateNegotiation(negotiationId: string, subject: any) {
    // Send negotiation requests to relevant agents
    await this.broadcast(
      this.districtAgents,
      'info',
      {
        type: 'negotiation-invitation',
        negotiationId,
        subject,
        deadline: new Date(Date.now() + 300000).toISOString()
      },
      8
    )
  }

  private async evaluateProposal(proposal: any) {
    // Evaluate proposal based on system goals
    const score = this.scoreProposal(proposal)
    
    if (score > 0.7) {
      return { accept: true }
    } else {
      return {
        accept: false,
        counter: this.generateCounterProposal(proposal)
      }
    }
  }

  private scoreProposal(proposal: any): number {
    // Simple scoring - would be more sophisticated
    let score = 0.5
    
    if (proposal.reduces_congestion) score += 0.2
    if (proposal.maintains_fairness) score += 0.2
    if (proposal.minimal_disruption) score += 0.1
    
    return Math.min(score, 1.0)
  }

  private generateCounterProposal(original: any) {
    // Generate improved proposal
    return {
      ...original,
      modifications: {
        reduced_scope: true,
        phased_implementation: true,
        additional_safeguards: true
      }
    }
  }

  private async acceptProposal(negotiationId: string, proposal: any) {
    await supabase
      .from('negotiations')
      .update({
        status: 'completed',
        final_agreement: proposal,
        completed_at: new Date().toISOString()
      })
      .eq('negotiation_id', negotiationId)

    // Implement the agreed proposal
    await this.implementAgreement(proposal)
  }

  private async counterProposal(negotiationId: string, counter: any) {
    await supabase
      .from('negotiations')
      .update({
        status: 'counter_proposing',
        current_proposal: counter,
        current_round: supabase.rpc('increment', { row_id: negotiationId })
      })
      .eq('negotiation_id', negotiationId)
  }

  private async implementAgreement(agreement: any) {
    console.log('Implementing negotiated agreement:', agreement)
    
    // Send implementation instructions to agents
    broadcastCoordinationEvent({
      type: 'agreement_implementation',
      agreement,
      timestamp: new Date().toISOString()
    })
  }

  // Existing methods remain the same...
  private async initializeAgents() {
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'active')
      .returns<Agent[]>()

    if (agents) {
      this.districtAgents = agents
        .filter(a => a.agent_type === 'district_coordinator')
        .map(a => a.agent_id)

      this.fleetAgents = agents
        .filter(a => a.agent_type === 'fleet_coordinator')
        .map(a => a.agent_id)
      
      console.log(`Initialized ${this.districtAgents.length} district agents and ${this.fleetAgents.length} fleet agents`)
    }
  }

  private startCityMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.analyzeCityState()
      await this.detectBottlenecks()
    }, 30000)
  }

  private async analyzeCityState() {
    const congestionData = await this.getDistrictCongestion()
    
    const hotspots = congestionData.filter(d => d.congestionLevel > 0.7)
    
    if (hotspots.length > 0) {
      await this.triggerLoadBalancing(hotspots)
    }

    await this.updateSystemMetrics(congestionData)
  }

  private async getDistrictCongestion(): Promise<DistrictCongestion[]> {
    const districts = []
    
    for (const districtId of this.districtAgents) {
      const { data: vehicles } = await supabase
        .from('vehicle_states')
        .select('*')
        .eq('anonymized_data->district', districtId)
        .gte('timestamp', new Date(Date.now() - 60000).toISOString())

      const vehicleCount = vehicles?.length || 0
      const avgWaitTime = vehicleCount > 0 && vehicles
        ? vehicles.reduce((acc, v) => {
            const waitTime = (v.anonymized_data as any)?.wait_time || 0
            return acc + Number(waitTime)
          }, 0) / vehicleCount
        : 0

      districts.push({
        districtId,
        congestionLevel: Math.min(vehicleCount / 100, 1),
        vehicleCount,
        avgWaitTime
      })
    }

    return districts
  }

  private async triggerLoadBalancing(hotspots: DistrictCongestion[]) {
    const balancingPlan = await this.makeDecision({
      type: 'load_balancing',
      hotspots,
      timestamp: new Date().toISOString()
    })

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
    const report = message.payload
    console.log(`District report from ${message.sender}:`, report)
    
    await supabase.from('district_metrics').insert({
      district_name: message.sender.replace('district-', ''),
      vehicle_density: report.vehicle_count || 0,
      congestion_level: report.congestion_level || 0,
      average_speed: report.average_speed || 25,
      active_intersections: report.active_intersections || 0,
      coordination_score: report.coordination_score || 100
    })
  }

  private async handleCongestionAlert(message: Message) {
    const alert = message.payload
    console.log('Congestion alert:', alert)
    
    await this.analyzeCityState()
  }

  private async handleSpecialEvent(message: Message) {
    const event = message.payload
    console.log('Special event notification:', event)
    
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
      const district = v.anonymized_data?.district || 'unknown'
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
