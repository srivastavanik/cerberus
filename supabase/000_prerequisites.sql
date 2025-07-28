-- Prerequisites for the SF AV Coordination System
-- Run this before the seed_agents.sql script

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT UNIQUE NOT NULL,
    fleet_size INTEGER DEFAULT 100,
    priority_base FLOAT DEFAULT 50.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the three AV companies
INSERT INTO companies (company_name, fleet_size, priority_base) VALUES 
    ('waymo', 150, 50.0),
    ('zoox', 100, 50.0),
    ('cruise', 120, 50.0)
ON CONFLICT (company_name) DO NOTHING;

-- Create intersections table
CREATE TABLE IF NOT EXISTS intersections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intersection_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    district TEXT NOT NULL,
    complexity TEXT CHECK (complexity IN ('low', 'medium', 'high')) DEFAULT 'medium',
    lanes_count INTEGER DEFAULT 4,
    has_traffic_light BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert major SF intersections
INSERT INTO intersections (intersection_id, name, location, district, complexity) VALUES
    -- SOMA District
    ('int_market_4th', 'Market & 4th St', ST_SetSRID(ST_MakePoint(-122.4048, 37.7858), 4326), 'SOMA', 'high'),
    ('int_market_5th', 'Market & 5th St', ST_SetSRID(ST_MakePoint(-122.4081, 37.7838), 4326), 'SOMA', 'high'),
    ('int_market_6th', 'Market & 6th St', ST_SetSRID(ST_MakePoint(-122.4104, 37.7818), 4326), 'SOMA', 'high'),
    ('int_howard_3rd', 'Howard & 3rd St', ST_SetSRID(ST_MakePoint(-122.4002, 37.7847), 4326), 'SOMA', 'medium'),
    
    -- Mission District
    ('int_mission_16th', 'Mission & 16th St', ST_SetSRID(ST_MakePoint(-122.4195, 37.7651), 4326), 'Mission', 'high'),
    ('int_mission_24th', 'Mission & 24th St', ST_SetSRID(ST_MakePoint(-122.4183, 37.7528), 4326), 'Mission', 'high'),
    ('int_valencia_16th', 'Valencia & 16th St', ST_SetSRID(ST_MakePoint(-122.4216, 37.7651), 4326), 'Mission', 'medium'),
    
    -- Financial District
    ('int_montgomery_market', 'Montgomery & Market', ST_SetSRID(ST_MakePoint(-122.4026, 37.7897), 4326), 'Financial', 'high'),
    ('int_california_montgomery', 'California & Montgomery', ST_SetSRID(ST_MakePoint(-122.4026, 37.7927), 4326), 'Financial', 'high'),
    ('int_battery_broadway', 'Battery & Broadway', ST_SetSRID(ST_MakePoint(-122.4005, 37.7988), 4326), 'Financial', 'medium'),
    
    -- Marina District
    ('int_lombard_fillmore', 'Lombard & Fillmore', ST_SetSRID(ST_MakePoint(-122.4362, 37.8009), 4326), 'Marina', 'high'),
    ('int_chestnut_fillmore', 'Chestnut & Fillmore', ST_SetSRID(ST_MakePoint(-122.4362, 37.8029), 4326), 'Marina', 'medium'),
    
    -- Castro District
    ('int_castro_market', 'Castro & Market', ST_SetSRID(ST_MakePoint(-122.4350, 37.7627), 4326), 'Castro', 'high'),
    ('int_castro_18th', 'Castro & 18th St', ST_SetSRID(ST_MakePoint(-122.4350, 37.7609), 4326), 'Castro', 'medium'),
    
    -- Sunset District
    ('int_19th_irving', '19th Ave & Irving', ST_SetSRID(ST_MakePoint(-122.4789, 37.7636), 4326), 'Sunset', 'high'),
    ('int_19th_judah', '19th Ave & Judah', ST_SetSRID(ST_MakePoint(-122.4789, 37.7617), 4326), 'Sunset', 'medium'),
    
    -- Richmond District
    ('int_geary_park', 'Geary & Park Presidio', ST_SetSRID(ST_MakePoint(-122.4667, 37.7812), 4326), 'Richmond', 'high'),
    ('int_fulton_park', 'Fulton & Park Presidio', ST_SetSRID(ST_MakePoint(-122.4667, 37.7730), 4326), 'Richmond', 'medium'),
    
    -- Haight District
    ('int_haight_masonic', 'Haight & Masonic', ST_SetSRID(ST_MakePoint(-122.4454, 37.7701), 4326), 'Haight', 'high'),
    ('int_haight_fillmore', 'Haight & Fillmore', ST_SetSRID(ST_MakePoint(-122.4306, 37.7720), 4326), 'Haight', 'medium'),
    
    -- Nob Hill
    ('int_california_powell', 'California & Powell', ST_SetSRID(ST_MakePoint(-122.4093, 37.7921), 4326), 'Nob_Hill', 'high'),
    ('int_california_mason', 'California & Mason', ST_SetSRID(ST_MakePoint(-122.4107, 37.7916), 4326), 'Nob_Hill', 'medium'),
    
    -- Chinatown
    ('int_broadway_grant', 'Broadway & Grant', ST_SetSRID(ST_MakePoint(-122.4071, 37.7978), 4326), 'Chinatown', 'high'),
    ('int_stockton_clay', 'Stockton & Clay', ST_SetSRID(ST_MakePoint(-122.4076, 37.7947), 4326), 'Chinatown', 'medium'),
    
    -- North Beach
    ('int_columbus_broadway', 'Columbus & Broadway', ST_SetSRID(ST_MakePoint(-122.4057, 37.7979), 4326), 'North_Beach', 'high'),
    ('int_columbus_union', 'Columbus & Union', ST_SetSRID(ST_MakePoint(-122.4093, 37.8002), 4326), 'North_Beach', 'medium'),
    
    -- Potrero Hill
    ('int_16th_potrero', '16th St & Potrero', ST_SetSRID(ST_MakePoint(-122.4075, 37.7659), 4326), 'Potrero', 'high'),
    ('int_cesar_chavez_potrero', 'Cesar Chavez & Potrero', ST_SetSRID(ST_MakePoint(-122.4068, 37.7481), 4326), 'Potrero', 'medium')
ON CONFLICT (intersection_id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_intersections_district ON intersections(district);
CREATE INDEX IF NOT EXISTS idx_intersections_complexity ON intersections(complexity);
CREATE INDEX IF NOT EXISTS idx_intersections_location ON intersections USING GIST(location);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE intersections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all" ON companies FOR SELECT USING (true);
CREATE POLICY "Enable read access for all" ON intersections FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all" ON intersections FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all" ON companies FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable update for all" ON intersections FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON companies FOR DELETE USING (true);
CREATE POLICY "Enable delete for all" ON intersections FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE companies;
ALTER PUBLICATION supabase_realtime ADD TABLE intersections;
