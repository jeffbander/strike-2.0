/**
 * Super Admin Seeding Script
 *
 * This script creates a Super Admin user. It should ONLY be run from the backend
 * (command line or secure deployment process). Super Admins cannot be created
 * through the UI.
 *
 * Usage:
 *   npx tsx scripts/seed-super-admin.ts <clerk-user-id> <email> <name>
 *
 * Example:
 *   npx tsx scripts/seed-super-admin.ts user_2abc123 admin@hospital.com "John Smith"
 *
 * Prerequisites:
 * 1. User must already exist in Clerk (sign up first)
 * 2. CLERK_SECRET_KEY must be set in environment
 * 3. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 */

import { createClient } from '@supabase/supabase-js';

async function seedSuperAdmin() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('\nUsage: npx tsx scripts/seed-super-admin.ts <clerk-user-id> <email> <name>');
    console.error('\nExample: npx tsx scripts/seed-super-admin.ts user_2abc123 admin@hospital.com "John Smith"');
    console.error('\nNote: The user must already exist in Clerk. Sign up first, then run this script.');
    process.exit(1);
  }

  const [clerkUserId, email, name] = args;

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('\nError: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }

  if (!clerkSecretKey) {
    console.error('\nError: CLERK_SECRET_KEY must be set');
    process.exit(1);
  }

  console.log('\n=== Super Admin Seeding Script ===\n');
  console.log('Clerk User ID:', clerkUserId);
  console.log('Email:', email);
  console.log('Name:', name);

  try {
    // 1. Verify user exists in Clerk and update metadata
    console.log('\n1. Verifying user exists in Clerk and setting role...');

    const clerkResponse = await fetch(
      `https://api.clerk.com/v1/users/${clerkUserId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_metadata: {
            role: 'super_admin',
            healthSystemId: null,
            hospitalId: null,
            departmentId: null,
          },
        }),
      }
    );

    if (!clerkResponse.ok) {
      const errorData = await clerkResponse.json();
      throw new Error(`Clerk API error: ${JSON.stringify(errorData)}`);
    }

    const clerkUser = await clerkResponse.json();
    console.log('   User verified:', clerkUser.email_addresses?.[0]?.email_address);
    console.log('   Role set successfully');

    // 2. Create Supabase client
    console.log('\n2. Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Check if super admin already exists
    console.log('\n3. Checking if super admin already exists...');
    const { data: existing } = await supabase
      .from('super_admins')
      .select('id')
      .or(`user_id.eq.${clerkUserId},email.eq.${email}`)
      .single();

    if (existing) {
      console.log('   Super admin already exists, updating...');
      const { error: updateError } = await supabase
        .from('super_admins')
        .update({ name, is_active: true })
        .eq('user_id', clerkUserId);

      if (updateError) throw updateError;
      console.log('   Updated successfully');
    } else {
      // 4. Insert super admin record
      console.log('\n4. Creating super admin record in database...');
      const { error: insertError } = await supabase
        .from('super_admins')
        .insert({
          user_id: clerkUserId,
          email,
          name,
          is_active: true,
        });

      if (insertError) throw insertError;
      console.log('   Created successfully');
    }

    console.log('\n=== Super Admin Created Successfully ===\n');
    console.log('The user can now log in and access Super Admin features.');
    console.log('They will be able to:');
    console.log('  - Create and manage Health Systems');
    console.log('  - Invite and manage Health System Admins');
    console.log('  - View all data across the platform');
    console.log('');

  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  }
}

seedSuperAdmin();
