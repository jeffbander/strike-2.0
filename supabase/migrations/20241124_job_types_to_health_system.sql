-- Migration: Move job_types from hospital level to health system level
-- This migration changes the job_types table to reference health_systems instead of hospitals

-- Step 1: Add health_system_id column (nullable initially for migration)
ALTER TABLE job_types
ADD COLUMN IF NOT EXISTS health_system_id UUID REFERENCES health_systems(id);

-- Step 2: Migrate existing data - get health_system_id from the hospital
UPDATE job_types jt
SET health_system_id = h.health_system_id
FROM hospitals h
WHERE jt.hospital_id = h.id
  AND jt.health_system_id IS NULL;

-- Step 3: For any orphaned records (hospital_id is null), assign to first health system or delete
-- Option A: Delete orphaned records
DELETE FROM job_types WHERE health_system_id IS NULL;

-- Step 4: Make health_system_id NOT NULL now that all records have a value
ALTER TABLE job_types
ALTER COLUMN health_system_id SET NOT NULL;

-- Step 5: Drop the hospital_id column (it's no longer needed)
ALTER TABLE job_types
DROP COLUMN IF EXISTS hospital_id;

-- Step 6: Create an index on health_system_id for better query performance
CREATE INDEX IF NOT EXISTS idx_job_types_health_system_id ON job_types(health_system_id);

-- Step 7: Add unique constraint to prevent duplicate job type codes within a health system
ALTER TABLE job_types
DROP CONSTRAINT IF EXISTS job_types_health_system_code_unique;

ALTER TABLE job_types
ADD CONSTRAINT job_types_health_system_code_unique UNIQUE (health_system_id, code);

-- Verification query (run manually to check)
-- SELECT jt.*, hs.name as health_system_name
-- FROM job_types jt
-- JOIN health_systems hs ON jt.health_system_id = hs.id;
