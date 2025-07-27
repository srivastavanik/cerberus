-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Coordination Events Table
CREATE TABLE coordination_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    participants TEXT[] DEFAULT '{}',
    location JSONB,
    duration_ms INTEGER,
    success_rate FLOAT,
    priority INTEGER DEFAULT 500,
    coordination_algorithm TEXT,
    outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicle States Table
CREATE TABLE vehicle_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id TEXT NOT NULL,
    company TEXT NOT NULL CHECK (company IN ('waymo', 'zoox', 'cruise')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grid_position JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'idle',
        'pickup',
        'enroute',
        'charging',
        'emergency_yield'
    )),
    anonymized_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    passenger_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intersection States Table
CREATE TABLE intersection_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intersection_id TEXT NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    queue_lengths JSONB NOT NULL DEFAULT '{}'::jsonb,
    average_wait_time FLOAT NOT NULL DEFAULT 0,
    active_negotiations JSONB NOT NULL DEFAULT '[]'::jsonb,
    traffic_light_state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Metrics Table (with all needed columns)
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    simulation_status TEXT DEFAULT 'stopped',
    scenario_type TEXT,
    agents_active INTEGER DEFAULT 0,
    simulation_start_time TIMESTAMPTZ,
    simulation_end_time TIMESTAMPTZ,
    ai_enabled BOOLEAN DEFAULT true,
    total_vehicles INTEGER NOT NULL DEFAULT 0,
    active_vehicles INTEGER DEFAULT 0,
    coordination_events INTEGER DEFAULT 0,
    system_efficiency FLOAT DEFAULT 0,
    coordination_score FLOAT DEFAULT 0,
    coordinations_per_minute FLOAT NOT NULL DEFAULT 0,
    average_wait_reduction FLOAT NOT NULL DEFAULT 0,
    fairness_score FLOAT NOT NULL DEFAULT 0 CHECK (fairness_score >= 0 AND fairness_score <= 100),
    emergency_response_time FLOAT DEFAULT NULL,
    district_congestion_levels JSONB NOT NULL DEFAULT '{}'::jsonb,
    system_message TEXT,
    total_events_processed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coordination Messages Table (for agent communication)
CREATE TABLE coordination_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    msg_id TEXT NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN (
        'proposal',
        'acceptance',
        'rejection',
        'info',
        'emergency'
    )),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 0 AND priority <= 1000),
    payload JSONB NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fleet Statistics Table
CREATE TABLE fleet_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company TEXT NOT NULL CHECK (company IN ('waymo', 'zoox', 'cruise')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active_vehicles INTEGER NOT NULL DEFAULT 0,
    idle_vehicles INTEGER NOT NULL DEFAULT 0,
    passenger_miles FLOAT NOT NULL DEFAULT 0,
    average_wait_time FLOAT NOT NULL DEFAULT 0,
    priority_score FLOAT NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- District Metrics Table (missing from original schema)
CREATE TABLE district_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vehicle_density INTEGER DEFAULT 0,
    congestion_level INTEGER DEFAULT 0 CHECK (congestion_level >= 0 AND congestion_level <= 10),
    average_speed FLOAT DEFAULT 25,
    active_intersections INTEGER DEFAULT 0,
    coordination_score FLOAT DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intersection Metrics Table (missing from original schema)
CREATE TABLE intersection_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intersection_id TEXT NOT NULL,
    intersection_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    throughput_per_hour INTEGER DEFAULT 0,
    average_wait_time FLOAT DEFAULT 0,
    congestion_score INTEGER DEFAULT 0 CHECK (congestion_score >= 0 AND congestion_score <= 10),
    signal_efficiency FLOAT DEFAULT 100,
    coordination_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_vehicle_states_timestamp ON vehicle_states(timestamp DESC);
CREATE INDEX idx_vehicle_states_company ON vehicle_states(company);
CREATE INDEX idx_coordination_events_timestamp ON coordination_events(timestamp DESC);
CREATE INDEX idx_coordination_events_type ON coordination_events(event_type);
CREATE INDEX idx_intersection_states_intersection_id ON intersection_states(intersection_id);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX idx_coordination_messages_status ON coordination_messages(status);
CREATE INDEX idx_coordination_messages_timestamp ON coordination_messages(timestamp DESC);
CREATE INDEX idx_coordination_messages_recipient ON coordination_messages(recipient);
CREATE INDEX idx_fleet_statistics_company ON fleet_statistics(company);
CREATE INDEX idx_fleet_statistics_timestamp ON fleet_statistics(timestamp DESC);
CREATE INDEX idx_district_metrics_timestamp ON district_metrics(timestamp DESC);
CREATE INDEX idx_district_metrics_district ON district_metrics(district_name);
CREATE INDEX idx_intersection_metrics_timestamp ON intersection_metrics(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE coordination_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE intersection_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordination_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE intersection_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (allow all operations for service role)
-- Read policies
CREATE POLICY "Enable read access for all" ON coordination_events FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON vehicle_states FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON intersection_states FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON system_metrics FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON coordination_messages FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON fleet_statistics FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON district_metrics FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON intersection_metrics FOR SELECT USING (true);

-- Insert policies
CREATE POLICY "Enable insert for all" ON coordination_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON vehicle_states FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON intersection_states FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON system_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON coordination_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON fleet_statistics FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON district_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON intersection_metrics FOR INSERT WITH CHECK (true);

-- Update policies
CREATE POLICY "Enable update for all" ON coordination_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON vehicle_states FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON intersection_states FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON system_metrics FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON coordination_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON fleet_statistics FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON district_metrics FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON intersection_metrics FOR UPDATE USING (true) WITH CHECK (true);

-- Delete policies
CREATE POLICY "Enable delete for all" ON coordination_events FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON vehicle_states FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON intersection_states FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON system_metrics FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON coordination_messages FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON fleet_statistics FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON district_metrics FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON intersection_metrics FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE coordination_events;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_states;
ALTER PUBLICATION supabase_realtime ADD TABLE intersection_states;
ALTER PUBLICATION supabase_realtime ADD TABLE system_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE coordination_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE fleet_statistics;
ALTER PUBLICATION supabase_realtime ADD TABLE district_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE intersection_metrics;
