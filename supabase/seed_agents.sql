-- Seed Script: Initialize Core Agents for SF AV Coordination System
-- Run this after migrations to create the initial agent hierarchy

-- Create City Orchestrator
WITH config AS (
  SELECT id FROM model_configurations WHERE config_name = 'default_nemotron'
),
prompt AS (
  SELECT id FROM agent_prompts WHERE prompt_name = 'city_orchestrator_v1'
)
INSERT INTO agents (
  agent_id, agent_type, agent_name,
  model_config_id, system_prompt_id,
  capabilities, perception_radius_meters,
  status
) 
SELECT 
  'city_orchestrator_main', 'city_orchestrator',
  'SF City Traffic Orchestrator',
  config.id, prompt.id,
  '["city_overview", "emergency_response", "fairness_enforcement", "district_coordination", "gaming_detection"]'::jsonb,
  50000, -- 50km radius covers entire SF
  'inactive'
FROM config, prompt;

-- Create District Coordinators for each major SF district
WITH config AS (
  SELECT id FROM model_configurations WHERE config_name = 'default_nemotron'
),
prompt AS (
  SELECT id FROM agent_prompts WHERE prompt_name = 'district_coordinator_v1'
),
districts AS (
  SELECT * FROM (VALUES
    ('district_soma', 'SOMA District Coordinator', '{"lat": 37.7749, "lng": -122.4194}'),
    ('district_mission', 'Mission District Coordinator', '{"lat": 37.7599, "lng": -122.4148}'), 
    ('district_financial', 'Financial District Coordinator', '{"lat": 37.7956, "lng": -122.4028}'),
    ('district_marina', 'Marina District Coordinator', '{"lat": 37.8037, "lng": -122.4368}'),
    ('district_castro', 'Castro District Coordinator', '{"lat": 37.7609, "lng": -122.4350}'),
    ('district_sunset', 'Sunset District Coordinator', '{"lat": 37.7485, "lng": -122.4942}'),
    ('district_richmond', 'Richmond District Coordinator', '{"lat": 37.7785, "lng": -122.4825}'),
    ('district_haight', 'Haight District Coordinator', '{"lat": 37.7692, "lng": -122.4481}'),
    ('district_nob_hill', 'Nob Hill District Coordinator', '{"lat": 37.7930, "lng": -122.4161}'),
    ('district_chinatown', 'Chinatown District Coordinator', '{"lat": 37.7941, "lng": -122.4078}'),
    ('district_north_beach', 'North Beach District Coordinator', '{"lat": 37.8060, "lng": -122.4103}'),
    ('district_potrero', 'Potrero Hill District Coordinator', '{"lat": 37.7565, "lng": -122.4005}')
  ) AS d(agent_id, agent_name, center_point)
)
INSERT INTO agents (
  agent_id, agent_type, agent_name,
  model_config_id, system_prompt_id,
  capabilities, perception_radius_meters,
  parent_agent_id, status
)
SELECT 
  d.agent_id, 'district_coordinator', d.agent_name,
  config.id, prompt.id,
  '["local_optimization", "intersection_management", "fleet_coordination", "emergency_routing"]'::jsonb,
  3000, -- 3km radius per district
  (SELECT id FROM agents WHERE agent_id = 'city_orchestrator_main'),
  'inactive'
FROM config, prompt, districts d;

-- Create Fleet Coordinators for each AV company
INSERT INTO agents (
  agent_id, agent_type, agent_name,
  model_config_id, system_prompt_id,
  capabilities, perception_radius_meters,
  parent_agent_id, managed_entity_id, status
)
SELECT 
  'fleet_' || company_name || '_coordinator',
  'fleet_coordinator',
  company_name || ' Fleet Coordinator',
  (SELECT id FROM model_configurations WHERE config_name = 'default_nemotron'),
  (SELECT id FROM agent_prompts WHERE prompt_name = 'city_orchestrator_v1'), -- Update when fleet prompt added
  '["vehicle_dispatch", "route_optimization", "company_representation", "auction_participation"]'::jsonb,
  50000, -- City-wide view for fleet
  (SELECT id FROM agents WHERE agent_id = 'city_orchestrator_main'),
  company_name,
  'inactive'
FROM companies;

-- Create Intersection Managers for major intersections
INSERT INTO agents (
  agent_id, agent_type, agent_name,
  model_config_id, system_prompt_id,
  capabilities, perception_radius_meters,
  parent_agent_id, managed_entity_id, status
)
SELECT 
  'intersection_' || intersection_id || '_manager',
  'intersection_manager',
  name || ' Manager',
  (SELECT id FROM model_configurations WHERE config_name = 'high_precision'),
  (SELECT id FROM agent_prompts WHERE prompt_name = 'city_orchestrator_v1'), -- Update when intersection prompt added
  '["signal_optimization", "auction_management", "safety_monitoring", "throughput_optimization"]'::jsonb,
  500, -- 500m radius around intersection
  (SELECT a.id FROM agents a 
   WHERE a.agent_type = 'district_coordinator' 
   AND a.agent_id = 'district_' || lower(i.district)
   LIMIT 1),
  intersection_id,
  'inactive'
FROM intersections i
WHERE complexity = 'high';

-- Create Special Service Coordinator for emergency vehicles
INSERT INTO agents (
  agent_id, agent_type, agent_name,
  model_config_id, system_prompt_id,
  capabilities, perception_radius_meters,
  parent_agent_id, status
)
VALUES (
  'special_service_coordinator',
  'special_service_coordinator',
  'SF Emergency Services Coordinator',
  (SELECT id FROM model_configurations WHERE config_name = 'high_precision'),
  (SELECT id FROM agent_prompts WHERE prompt_name = 'city_orchestrator_v1'), -- Update when special service prompt added
  '["emergency_routing", "corridor_creation", "priority_override", "multi_agency_coordination"]'::jsonb,
  50000, -- City-wide view
  (SELECT id FROM agents WHERE agent_id = 'city_orchestrator_main'),
  'inactive'
);

-- Set up agent hierarchy relationships
INSERT INTO agent_hierarchy (parent_agent_id, child_agent_id, relationship_type, priority)
SELECT 
  p.id AS parent_id,
  c.id AS child_id,
  'supervises' AS relationship_type,
  CASE 
    WHEN c.agent_type = 'special_service_coordinator' THEN 1 -- Highest priority
    WHEN c.agent_type = 'district_coordinator' THEN 10
    WHEN c.agent_type = 'fleet_coordinator' THEN 20
    ELSE 30
  END AS priority
FROM agents p
JOIN agents c ON c.parent_agent_id = p.id
WHERE p.agent_id = 'city_orchestrator_main';

-- Add peer relationships between district coordinators
INSERT INTO agent_hierarchy (parent_agent_id, child_agent_id, relationship_type, priority)
SELECT 
  a1.id,
  a2.id,
  'peer',
  50
FROM agents a1
JOIN agents a2 ON a1.agent_type = 'district_coordinator' 
  AND a2.agent_type = 'district_coordinator'
  AND a1.id != a2.id
WHERE a1.agent_id < a2.agent_id; -- Prevent duplicates

-- Create initial memory entries for agents
INSERT INTO agent_memory (
  agent_id, memory_type, content, 
  importance_score, metadata
)
SELECT 
  id,
  'entity',
  'System initialization: Agent ' || agent_name || ' created and configured.',
  1.0,
  jsonb_build_object(
    'event_type', 'initialization',
    'timestamp', NOW(),
    'capabilities', capabilities
  )
FROM agents;

-- Log agent creation decisions
INSERT INTO agent_decisions (
  agent_id, decision_id, decision_type,
  action_taken, reasoning_chain,
  confidence_score, explanation,
  input_data, outcome
)
SELECT 
  id,
  'init_' || agent_id,
  'initialization',
  jsonb_build_object('action', 'agent_created', 'config', 'default'),
  jsonb_build_array(
    jsonb_build_object('step', 1, 'reasoning', 'System requires ' || agent_type || ' for coordination'),
    jsonb_build_object('step', 2, 'reasoning', 'Configured with standard capabilities'),
    jsonb_build_object('step', 3, 'reasoning', 'Ready for activation')
  ),
  1.0,
  'Agent created as part of system initialization with default configuration.',
  jsonb_build_object('trigger', 'system_setup'),
  'success'
FROM agents;

-- Summary
SELECT 
  agent_type,
  COUNT(*) as count,
  STRING_AGG(agent_name, ', ' ORDER BY agent_name) as agents
FROM agents
GROUP BY agent_type
ORDER BY agent_type;

-- Verify hierarchy
SELECT 
  p.agent_name as parent,
  c.agent_name as child,
  ah.relationship_type,
  ah.priority
FROM agent_hierarchy ah
JOIN agents p ON ah.parent_agent_id = p.id
JOIN agents c ON ah.child_agent_id = c.id
ORDER BY ah.priority, p.agent_name, c.agent_name
LIMIT 20;
