-- CHUNK 2: SCENARIO & SIMULATION MANAGEMENT
-- ==========================================
-- Infrastructure for creating and running scenarios

-- Scenario configurations
CREATE TABLE scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scenario_type TEXT NOT NULL CHECK (scenario_type IN (
        'rush_hour', 'emergency', 'special_event', 'weather_impact', 
        'fleet_competition', 'custom', 'stress_test'
    )),
    
    -- Environmental parameters
    time_of_day TIME,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    weather_conditions JSONB DEFAULT '{
        "condition": "clear",
        "visibility": 10,
        "precipitation": 0,
        "wind_speed": 0
    }'::jsonb,
    
    -- Traffic parameters
    base_traffic_level INTEGER DEFAULT 5 CHECK (base_traffic_level >= 1 AND base_traffic_level <= 10),
    vehicle_spawn_rate FLOAT DEFAULT 10.0, -- vehicles per minute
    initial_vehicle_count INTEGER DEFAULT 100,
    
    -- Simulation parameters
    duration_seconds INTEGER DEFAULT 3600,
    speed_multiplier FLOAT DEFAULT 1.0,
    random_seed INTEGER,
    
    -- Configuration
    agent_configuration JSONB DEFAULT '{}'::jsonb,
    district_settings JSONB DEFAULT '{}'::jsonb,
    fleet_distribution JSONB DEFAULT '{
        "waymo": 0.34,
        "zoox": 0.33,
        "cruise": 0.33
    }'::jsonb,
    
    is_template BOOLEAN DEFAULT false,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-built scenario templates
CREATE TABLE scenario_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template configuration
    base_scenario_id UUID REFERENCES scenarios(id),
    modifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    average_completion_time INTEGER,
    success_rate FLOAT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scenario triggers and conditions
CREATE TABLE scenario_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    trigger_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'time_based', 'condition_based', 'cascade', 'random', 'manual'
    )),
    
    -- Trigger configuration
    trigger_time INTEGER, -- seconds from scenario start
    trigger_condition JSONB, -- condition expression
    trigger_probability FLOAT DEFAULT 1.0,
    
    -- Action to take
    action_type TEXT NOT NULL CHECK (action_type IN (
        'spawn_vehicles', 'create_incident', 'change_weather', 
        'start_event', 'modify_traffic', 'trigger_emergency'
    )),
    action_parameters JSONB NOT NULL,
    
    -- Cascade settings
    parent_trigger_id UUID REFERENCES scenario_triggers(id),
    delay_after_parent INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(scenario_id, trigger_id)
);

-- Scheduled events within scenarios
CREATE TABLE scenario_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'game', 'concert', 'parade', 'accident', 'construction',
        'emergency', 'vip_movement', 'protest', 'weather_change'
    )),
    
    -- Event timing
    start_time INTEGER NOT NULL, -- seconds from scenario start
    duration INTEGER NOT NULL, -- duration in seconds
    
    -- Event location
    location_type TEXT NOT NULL CHECK (location_type IN ('point', 'area', 'route')),
    location GEOMETRY(Geometry, 4326) NOT NULL,
    affected_radius_meters INTEGER DEFAULT 500,
    
    -- Event impact
    severity INTEGER DEFAULT 5 CHECK (severity >= 1 AND severity <= 10),
    expected_attendance INTEGER, -- for events
    traffic_impact_multiplier FLOAT DEFAULT 1.5,
    
    -- Event configuration
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    required_resources JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(scenario_id, event_id)
);

-- Scenario execution history
CREATE TABLE scenario_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id TEXT UNIQUE NOT NULL,
    scenario_id UUID NOT NULL REFERENCES scenarios(id),
    
    -- Run timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    scheduled_duration INTEGER NOT NULL,
    actual_duration INTEGER,
    
    -- Run status
    status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN (
        'preparing', 'running', 'paused', 'completed', 'failed', 'cancelled'
    )),
    completion_percentage FLOAT DEFAULT 0,
    
    -- Run configuration
    speed_multiplier FLOAT NOT NULL DEFAULT 1.0,
    random_seed INTEGER,
    modified_parameters JSONB DEFAULT '{}'::jsonb,
    
    -- Run metrics
    total_vehicles_spawned INTEGER DEFAULT 0,
    total_trips_completed INTEGER DEFAULT 0,
    average_trip_time FLOAT,
    total_coordination_events INTEGER DEFAULT 0,
    
    -- Performance metrics
    average_wait_time FLOAT,
    congestion_incidents INTEGER DEFAULT 0,
    emergency_response_times JSONB DEFAULT '[]'::jsonb,
    system_efficiency_score FLOAT,
    
    -- Run metadata
    initiated_by TEXT NOT NULL,
    purpose TEXT,
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Simulation state snapshots
CREATE TABLE simulation_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    simulation_time INTEGER NOT NULL, -- seconds from start
    
    -- System state
    active_vehicles INTEGER NOT NULL,
    vehicles_by_company JSONB NOT NULL,
    vehicles_by_status JSONB NOT NULL,
    
    -- Traffic state
    district_congestion JSONB NOT NULL,
    intersection_queues JSONB NOT NULL,
    average_speeds JSONB NOT NULL,
    
    -- Coordination state
    active_negotiations INTEGER,
    coordination_success_rate FLOAT,
    emergency_corridors_active INTEGER,
    
    -- Agent state
    active_agents INTEGER,
    agent_utilization JSONB,
    decision_latencies JSONB,
    
    -- Checkpoint data for replay
    full_state_snapshot JSONB,
    can_resume_from BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_scenarios_type ON scenarios(scenario_type);
CREATE INDEX idx_scenarios_template ON scenarios(is_template);

CREATE INDEX idx_scenario_templates_category ON scenario_templates(category);
CREATE INDEX idx_scenario_templates_active ON scenario_templates(is_active);

CREATE INDEX idx_scenario_triggers_scenario ON scenario_triggers(scenario_id);
CREATE INDEX idx_scenario_triggers_type ON scenario_triggers(trigger_type);
CREATE INDEX idx_scenario_triggers_time ON scenario_triggers(trigger_time);

CREATE INDEX idx_scenario_events_scenario ON scenario_events(scenario_id);
CREATE INDEX idx_scenario_events_type ON scenario_events(event_type);
CREATE INDEX idx_scenario_events_time ON scenario_events(start_time);
CREATE INDEX idx_scenario_events_location ON scenario_events USING GIST(location);

CREATE INDEX idx_scenario_runs_scenario ON scenario_runs(scenario_id);
CREATE INDEX idx_scenario_runs_status ON scenario_runs(status);
CREATE INDEX idx_scenario_runs_started ON scenario_runs(started_at DESC);

CREATE INDEX idx_simulation_states_run ON simulation_states(run_id);
CREATE INDEX idx_simulation_states_time ON simulation_states(simulation_time);
CREATE INDEX idx_simulation_states_checkpoint ON simulation_states(can_resume_from);

-- Enable Row Level Security
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_states ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Read policies
CREATE POLICY "Enable read access for all" ON scenarios FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON scenario_templates FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON scenario_triggers FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON scenario_events FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON scenario_runs FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON simulation_states FOR SELECT USING (true);

-- Insert policies
CREATE POLICY "Enable insert for all" ON scenarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON scenario_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON scenario_triggers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON scenario_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON scenario_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON simulation_states FOR INSERT WITH CHECK (true);

-- Update policies
CREATE POLICY "Enable update for all" ON scenarios FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON scenario_templates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON scenario_triggers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON scenario_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON scenario_runs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON simulation_states FOR UPDATE USING (true) WITH CHECK (true);

-- Delete policies
CREATE POLICY "Enable delete for all" ON scenarios FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON scenario_templates FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON scenario_triggers FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON scenario_events FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON scenario_runs FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON simulation_states FOR DELETE USING (true);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE scenario_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE simulation_states;

-- Insert default scenario templates
INSERT INTO scenarios (scenario_id, name, description, scenario_type, time_of_day, base_traffic_level, is_template, created_by)
VALUES 
    ('template_rush_hour', 'Rush Hour Template', 'Standard morning rush hour scenario', 'rush_hour', '08:00:00', 8, true, 'system'),
    ('template_giants_game', 'Giants Game Template', 'Oracle Park game day scenario', 'special_event', '19:00:00', 7, true, 'system'),
    ('template_emergency', 'Emergency Response Template', 'Multi-emergency response scenario', 'emergency', '14:00:00', 5, true, 'system');

INSERT INTO scenario_templates (template_id, category, name, description, base_scenario_id)
SELECT 'rush_hour_basic', 'traffic', 'Basic Rush Hour', 'Standard weekday morning commute', id
FROM scenarios WHERE scenario_id = 'template_rush_hour';
