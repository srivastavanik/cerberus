-- Migration script to update existing schema
-- Run this in your Supabase SQL editor

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON coordination_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON vehicle_states;
DROP POLICY IF EXISTS "Enable read access for all users" ON intersection_states;
DROP POLICY IF EXISTS "Enable read access for all users" ON system_metrics;
DROP POLICY IF EXISTS "Enable read access for all users" ON coordination_messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON fleet_statistics;

-- Drop existing tables to recreate with correct schema
DROP TABLE IF EXISTS coordination_messages CASCADE;
DROP TABLE IF EXISTS coordination_events CASCADE;
DROP TABLE IF EXISTS vehicle_states CASCADE;
DROP TABLE IF EXISTS intersection_states CASCADE;
DROP TABLE IF EXISTS system_metrics CASCADE;
DROP TABLE IF EXISTS fleet_statistics CASCADE;
DROP TABLE IF EXISTS district_metrics CASCADE;
DROP TABLE IF EXISTS intersection_metrics CASCADE;

-- Now run the full schema from schema.sql
-- (Copy and paste the entire content of schema.sql here)

-- Or if you prefer, you can ALTER existing tables instead:
-- Example for system_metrics:
/*
ALTER TABLE system_metrics 
ADD COLUMN IF NOT EXISTS agents_active INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS simulation_status TEXT DEFAULT 'stopped',
ADD COLUMN IF NOT EXISTS scenario_type TEXT,
ADD COLUMN IF NOT EXISTS simulation_start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS simulation_end_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS active_vehicles INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coordination_events INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS system_efficiency FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS coordination_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS system_message TEXT,
ADD COLUMN IF NOT EXISTS total_events_processed INTEGER DEFAULT 0;
*/
