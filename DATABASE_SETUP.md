# Database Setup Instructions

## 🚨 IMPORTANT: You need to update your Supabase database schema

The application is experiencing errors because the database schema is missing required tables and columns.

## Step 1: Update Your Supabase Database

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/wuuepjagaosqrivklssq

2. Navigate to the SQL Editor

3. Copy and paste the ENTIRE content from `supabase/schema.sql` into the SQL editor

4. Click "Run" to execute the schema

**Note:** If you get errors about existing tables, you can either:
- Option A: Use the migration script from `supabase/migrate_schema.sql` first to drop existing tables
- Option B: Manually drop existing tables in the Table Editor before running the schema

## Step 2: Verify Tables Were Created

After running the schema, verify these tables exist:
- ✅ coordination_events
- ✅ vehicle_states  
- ✅ intersection_states
- ✅ system_metrics (with `agents_active` column)
- ✅ coordination_messages
- ✅ fleet_statistics
- ✅ district_metrics (NEW - was missing)
- ✅ intersection_metrics (NEW - was missing)

## Step 3: Check Row Level Security

The schema includes RLS policies that allow all operations. If you still get RLS errors, you can temporarily disable RLS:

```sql
-- Disable RLS temporarily for testing
ALTER TABLE coordination_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE intersection_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE coordination_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_statistics DISABLE ROW LEVEL SECURITY;
ALTER TABLE district_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE intersection_metrics DISABLE ROW LEVEL SECURITY;
```

## Step 4: Update NVIDIA API Key (Optional)

If you have an NVIDIA API key, update it in `.env.local`:

```bash
NVIDIA_API_KEY=nvapi-YOUR_ACTUAL_KEY_HERE
```

If you don't have one yet, the system will work with rule-based logic instead of AI optimization.

## Step 5: Restart the Development Server

After updating the database:

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

## Testing the System

Once the database is set up correctly, test with:

```bash
# 1. Generate traffic data
curl -X POST http://localhost:3000/api/data/generate \
  -H "Content-Type: application/json" \
  -d '{"vehicleCount": 750, "scenario": "normal"}'

# 2. Start simulation
curl -X POST http://localhost:3000/api/simulation/start \
  -H "Content-Type: application/json" \
  -d '{"scenario": "rush_hour", "duration": 3600}'

# 3. Start agents
curl -X POST http://localhost:3000/api/agents/start
```

## Common Issues

### Issue: "Could not find the 'agents_active' column"
**Solution:** The system_metrics table is missing columns. Re-run the schema.

### Issue: "new row violates row-level security policy"
**Solution:** The app is now using the service role key for API routes, but if issues persist, disable RLS as shown in Step 3.

### Issue: 404/406 errors on district_metrics or system_metrics
**Solution:** These tables are missing or have incorrect schemas. Re-run the complete schema.

## Support

If you continue to have issues:
1. Check the Supabase logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure the schema was applied without errors
