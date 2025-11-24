-- Migration: Add service_job_type_id column to shifts and job_positions tables
-- This links shifts and job positions to specific job types within a service

-- Step 1: Add the service_job_type_id column to shifts table
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS service_job_type_id UUID REFERENCES service_job_types(id);

-- Step 2: Create an index for better query performance on shifts
CREATE INDEX IF NOT EXISTS idx_shifts_service_job_type_id ON shifts(service_job_type_id);

-- Step 3: Add the service_job_type_id column to job_positions table
ALTER TABLE job_positions
ADD COLUMN IF NOT EXISTS service_job_type_id UUID REFERENCES service_job_types(id);

-- Step 4: Create an index for better query performance on job_positions
CREATE INDEX IF NOT EXISTS idx_job_positions_service_job_type_id ON job_positions(service_job_type_id);

-- Note: Existing records will have NULL service_job_type_id
-- New records created through the API will have this field populated
