# SF AV Coordination System - Database Migration Guide

## Overview

This guide explains the comprehensive database schema additions required to support the full SF AV Coordination System with NVIDIA Nemotron-powered multi-agent AI capabilities.

## Migration Files

The schema is split into 4 logical chunks, each building upon the previous:

### 1. **001_agent_system_core.sql** - Core Agent Infrastructure
**Tables Added:**
- `model_configurations` - NVIDIA Nemotron model settings
- `agent_prompts` - System prompts for different agent types
- `agents` - Agent instances (City Orchestrator, District Coordinators, etc.)
- `agent_hierarchy` - Parent-child relationships between agents
- `agent_decisions` - Decision history with reasoning chains
- `agent_memory` - Multi-type memory systems (conversation, entity, pattern, vector)

**Key Features:**
- Supports 7 agent types (city_orchestrator, district_coordinator, fleet_coordinator, etc.)
- Vector embeddings for semantic memory search
- Complete decision audit trail with explanations
- Configurable AI model parameters per agent type

### 2. **002_scenario_simulation.sql** - Scenario & Simulation Management
**Tables Added:**
- `scenarios` - Scenario configurations
- `scenario_templates` - Pre-built scenarios (rush hour, events, emergencies)
- `scenario_triggers` - Time/condition-based triggers
- `scenario_events` - Scheduled events within scenarios
- `scenario_runs` - Execution history
- `simulation_states` - State snapshots for replay

**Key Features:**
- 7 scenario types (rush_hour, emergency, special_event, etc.)
- Cascading trigger system
- Full simulation state checkpointing
- Performance metrics tracking

### 3. **003_coordination_learning.sql** - Advanced Coordination & Learning
**Tables Added:**
- `negotiations` - Multi-round agent negotiations
- `consensus_decisions` - Voting and quorum-based decisions
- `commitments` - Binding agreements between agents
- `emergency_protocols` - Emergency response strategies
- `emergency_corridors` - Active emergency routes
- `learning_patterns` - Successful strategy patterns
- `fairness_policies` - Company fairness rules
- `gaming_attempts` - Gaming detection and prevention

**Key Features:**
- 6 negotiation types with proposal history
- Emergency corridor creation with PostGIS geometry
- Evolutionary learning with pattern mutations
- Anti-gaming enforcement

### 4. **004_analytics_integration_compliance.sql** - Analytics & Compliance
**Tables Added:**
- `traffic_predictions` - ML model predictions
- `bottleneck_analysis` - Problem identification
- `historical_patterns` - Time-series patterns
- `external_data_sources` - API integrations
- `decision_audit_trail` - Compliance tracking
- `human_interventions` - Manual override tracking
- `system_anomalies` - Anomaly detection
- `performance_benchmarks` - KPI tracking

**Also Enhances Existing Tables:**
- `vehicle_states` - Adds agent assignment, routes, priority
- `intersection_states` - Adds controlling agent, auction state
- `district_metrics` - Adds weather, scenarios, controlling agents

## Prerequisites

1. **PostgreSQL Extensions Required:**
   - `uuid-ossp` - UUID generation (usually enabled by default)
   - `postgis` - Spatial data (already in original schema)

2. **Supabase Setup:**
   - Ensure you have a Supabase project
   - Database should have the original schema already applied

## Migration Steps

### Step 1: Apply Migrations in Order
Apply each migration file in sequence:

```bash
# From the Supabase SQL editor, run each file in order:
1. Run migrations/001_agent_system_core.sql
2. Run migrations/002_scenario_simulation.sql
3. Run migrations/003_coordination_learning.sql
4. Run migrations/004_analytics_integration_compliance.sql
```

### Step 3: Verify Installation
Check that all tables were created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see 36+ tables including all the new ones.

### Step 4: Test Real-time Subscriptions
Verify real-time is working for key tables:
```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

## Usage Examples

### Creating the City Orchestrator Agent
```sql
-- First get the model config and prompt IDs
WITH config AS (
  SELECT id FROM model_configurations WHERE config_name = 'default_nemotron'
),
prompt AS (
  SELECT id FROM agent_prompts WHERE prompt_name = 'city_orchestrator_v1'
)
INSERT INTO agents (
  agent_id, 
  agent_type, 
  agent_name,
  model_config_id,
  system_prompt_id,
  capabilities,
  perception_radius_meters
) 
SELECT 
  'city_orchestrator_main',
  'city_orchestrator',
  'SF City Traffic Orchestrator',
  config.id,
  prompt.id,
  '["city_overview", "emergency_response", "fairness_enforcement"]'::jsonb,
  50000 -- 50km radius (entire city)
FROM config, prompt;
```

### Creating an Emergency Corridor
```sql
-- When an emergency vehicle needs priority routing
INSERT INTO emergency_corridors (
  corridor_id,
  protocol_id,
  emergency_type,
  emergency_vehicles,
  destination,
  corridor_path,
  buffer_distance_meters,
  affected_intersections,
  affected_districts,
  estimated_duration_seconds,
  coordinating_agents,
  created_by
) VALUES (
  'emrg_2024_001',
  (SELECT id FROM emergency_protocols WHERE protocol_id = 'medical_emergency_v1'),
  'medical',
  ARRAY['amb_001']::uuid[],
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326), -- SF General Hospital
  ST_SetSRID(ST_MakeLine(
    ST_MakePoint(-122.4330, 37.7599), -- Start
    ST_MakePoint(-122.4194, 37.7749)  -- End
  ), 4326),
  100, -- 100m buffer
  ARRAY['int_market_4th', 'int_mission_16th'],
  ARRAY['SOMA', 'Mission'],
  300, -- 5 minutes
  ARRAY[(SELECT id FROM agents WHERE agent_id = 'city_orchestrator_main')],
  (SELECT id FROM agents WHERE agent_id = 'city_orchestrator_main')
);
```

### Recording a Gaming Attempt
```sql
INSERT INTO gaming_attempts (
  attempt_id,
  company_name,
  gaming_type,
  severity,
  detection_method,
  evidence,
  confidence_score
) VALUES (
  'gaming_2024_001',
  'waymo',
  'priority_manipulation',
  7,
  'pattern_analysis',
  '{"false_urgency_claims": 15, "time_window": "2024-01-15 08:00-09:00"}'::jsonb,
  0.89
);
```

## Best Practices

1. **Agent Creation Order:**
   - Create City Orchestrator first
   - Then District Coordinators
   - Then specialized agents
   - Finally, vehicle agents

2. **Memory Management:**
   - Set appropriate `decay_rate` for different memory types
   - Use `expires_at` for temporary memories
   - Index embeddings for fast similarity search

3. **Scenario Design:**
   - Start with templates
   - Test triggers independently
   - Use checkpoints for long scenarios

4. **Performance Optimization:**
   - Partition large tables by timestamp if needed
   - Use connection pooling for agent queries
   - Monitor index usage

## Monitoring

Key metrics to track:
- Agent decision latency
- Memory query performance  
- Negotiation success rates
- Emergency response times
- Gaming detection accuracy

## Rollback

To rollback, drop tables in reverse order:
```sql
-- Run these carefully!
DROP TABLE IF EXISTS performance_benchmarks CASCADE;
DROP TABLE IF EXISTS system_anomalies CASCADE;
-- ... etc in reverse order
```

## Support

For issues or questions:
1. Check table constraints if inserts fail
2. Verify foreign key relationships
3. Ensure all extensions are enabled
4. Monitor Supabase logs for errors
