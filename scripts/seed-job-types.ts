/**
 * Job Types Seeding Script
 *
 * This script creates default job types for a health system.
 * Job types are defined at the health system level so they can be shared
 * across all hospitals within that health system.
 *
 * Usage:
 *   npx tsx scripts/seed-job-types.ts <health-system-id>
 *
 * Example:
 *   npx tsx scripts/seed-job-types.ts 550e8400-e29b-41d4-a716-446655440000
 *
 * Prerequisites:
 * 1. Health system must already exist in the database
 * 2. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Default job types (without DO as requested)
const DEFAULT_JOB_TYPES = [
  { name: 'Certified Nursing Assistant', code: 'CNA' },
  { name: 'Fellow', code: 'FEL' },
  { name: 'Licensed Practical Nurse', code: 'LPN' },
  { name: 'Medical Doctor', code: 'MD' },
  { name: 'Medical Technician', code: 'MT' },
  { name: 'Nurse Practitioner', code: 'NP' },
  { name: 'Physician Assistant', code: 'PA' },
  { name: 'Registered Nurse', code: 'RN' },
  { name: 'Resident', code: 'RES' },
];

async function seedJobTypes() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('\nUsage: npx tsx scripts/seed-job-types.ts <health-system-id>');
    console.error('\nExample: npx tsx scripts/seed-job-types.ts 550e8400-e29b-41d4-a716-446655440000');
    console.error('\nNote: The health system must already exist in the database.');
    process.exit(1);
  }

  const [healthSystemId] = args;

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\nError: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  console.log('\n=== Job Types Seeding Script ===\n');
  console.log('Health System ID:', healthSystemId);

  try {
    // 1. Create Supabase client
    console.log('\n1. Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Verify health system exists
    console.log('\n2. Verifying health system exists...');
    const { data: healthSystem, error: hsError } = await supabase
      .from('health_systems')
      .select('id, name')
      .eq('id', healthSystemId)
      .single();

    if (hsError || !healthSystem) {
      throw new Error(`Health system not found: ${healthSystemId}`);
    }
    console.log('   Found health system:', healthSystem.name);

    // 3. Check for existing job types
    console.log('\n3. Checking for existing job types...');
    const { data: existingJobTypes } = await supabase
      .from('job_types')
      .select('code')
      .eq('health_system_id', healthSystemId);

    const existingCodes = new Set(existingJobTypes?.map((jt) => jt.code) || []);
    console.log('   Existing job types:', existingCodes.size);

    // 4. Insert new job types (skip if already exists)
    console.log('\n4. Creating job types...');
    const newJobTypes = DEFAULT_JOB_TYPES.filter((jt) => !existingCodes.has(jt.code));

    if (newJobTypes.length === 0) {
      console.log('   All default job types already exist. Nothing to add.');
    } else {
      const insertData = newJobTypes.map((jt) => ({
        health_system_id: healthSystemId,
        name: jt.name,
        code: jt.code,
        is_default: true,
        is_active: true,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('job_types')
        .insert(insertData)
        .select();

      if (insertError) throw insertError;

      console.log(`   Created ${inserted?.length || 0} job types:`);
      inserted?.forEach((jt) => {
        console.log(`     - ${jt.name} (${jt.code})`);
      });
    }

    console.log('\n=== Job Types Seeded Successfully ===\n');
    console.log('Available job types for this health system:');
    DEFAULT_JOB_TYPES.forEach((jt) => {
      const status = existingCodes.has(jt.code) ? '(existing)' : '(new)';
      console.log(`  - ${jt.name} (${jt.code}) ${status}`);
    });
    console.log('');

  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  }
}

seedJobTypes();
