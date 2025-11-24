import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';

type WebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; id: string }>;
    primary_email_address_id?: string;
    first_name?: string;
    last_name?: string;
    public_metadata?: {
      role?: string;
      healthSystemId?: string;
      hospitalId?: string;
      departmentId?: string;
    };
    deleted?: boolean;
  };
};

/**
 * POST /api/webhooks/clerk - Clerk webhook handler
 *
 * Handles user events from Clerk:
 * - user.created: Logs new user creation
 * - user.updated: Syncs role changes to database
 * - user.deleted: Deactivates admin records
 */
export async function POST(request: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Get body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the event
  const { type, data } = evt;

  console.log(`Clerk webhook received: ${type}`);

  try {
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;

      case 'user.updated':
        await handleUserUpdated(data);
        break;

      case 'user.deleted':
        await handleUserDeleted(data);
        break;

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Error handling ${type}:`, error);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
}

async function handleUserCreated(data: WebhookEvent['data']) {
  const email = data.email_addresses?.find(
    e => e.id === data.primary_email_address_id
  )?.email_address;

  console.log(`User created: ${data.id} (${email})`);

  await logAudit({
    userId: data.id,
    action: 'CREATE',
    resourceType: 'USER',
    resourceId: data.id,
    changes: { email, firstName: data.first_name, lastName: data.last_name },
  });
}

async function handleUserUpdated(data: WebhookEvent['data']) {
  const email = data.email_addresses?.find(
    e => e.id === data.primary_email_address_id
  )?.email_address;

  const metadata = data.public_metadata;

  console.log(`User updated: ${data.id} (${email})`, metadata);

  // If role was updated, ensure database records are in sync
  if (metadata?.role) {
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown';

    // Update or create admin record based on role
    if (metadata.role === 'super_admin') {
      const { data: existing } = await supabaseAdmin
        .from('super_admins')
        .select('id')
        .eq('user_id', data.id)
        .single();

      if (!existing && email) {
        await supabaseAdmin.from('super_admins').insert({
          user_id: data.id,
          email,
          name,
          is_active: true,
        });
      }
    }

    if (metadata.role === 'health_system_admin' && metadata.healthSystemId) {
      const { data: existing } = await supabaseAdmin
        .from('health_system_admins')
        .select('id')
        .eq('user_id', data.id)
        .single();

      if (!existing && email) {
        await supabaseAdmin.from('health_system_admins').insert({
          health_system_id: metadata.healthSystemId,
          user_id: data.id,
          email,
          name,
          is_active: true,
        });
      } else if (existing) {
        await supabaseAdmin
          .from('health_system_admins')
          .update({ name, is_active: true })
          .eq('user_id', data.id);
      }
    }

    if (metadata.role === 'hospital_admin' && metadata.hospitalId) {
      const { data: existing } = await supabaseAdmin
        .from('hospital_admins')
        .select('id')
        .eq('user_id', data.id)
        .single();

      if (!existing && email) {
        await supabaseAdmin.from('hospital_admins').insert({
          hospital_id: metadata.hospitalId,
          user_id: data.id,
          email,
          name,
          can_manage_multiple_hospitals: false,
          is_active: true,
        });
      } else if (existing) {
        await supabaseAdmin
          .from('hospital_admins')
          .update({ name, is_active: true })
          .eq('user_id', data.id);
      }
    }

    if (metadata.role === 'departmental_admin' && metadata.departmentId) {
      const { data: existing } = await supabaseAdmin
        .from('departmental_admins')
        .select('id')
        .eq('user_id', data.id)
        .single();

      if (!existing && email) {
        await supabaseAdmin.from('departmental_admins').insert({
          department_id: metadata.departmentId,
          user_id: data.id,
          email,
          name,
          can_add_other_admins: true,
          assigned_by: 'system',
          is_active: true,
        });
      } else if (existing) {
        await supabaseAdmin
          .from('departmental_admins')
          .update({ name, is_active: true })
          .eq('user_id', data.id);
      }
    }
  }

  await logAudit({
    userId: data.id,
    action: 'UPDATE',
    resourceType: 'USER',
    resourceId: data.id,
    changes: { metadata },
  });
}

async function handleUserDeleted(data: WebhookEvent['data']) {
  console.log(`User deleted: ${data.id}`);

  // Deactivate all admin records for this user
  await Promise.all([
    supabaseAdmin
      .from('super_admins')
      .update({ is_active: false })
      .eq('user_id', data.id),
    supabaseAdmin
      .from('health_system_admins')
      .update({ is_active: false })
      .eq('user_id', data.id),
    supabaseAdmin
      .from('hospital_admins')
      .update({ is_active: false })
      .eq('user_id', data.id),
    supabaseAdmin
      .from('departmental_admins')
      .update({ is_active: false })
      .eq('user_id', data.id),
  ]);

  await logAudit({
    userId: data.id,
    action: 'DELETE',
    resourceType: 'USER',
    resourceId: data.id,
    changes: { deleted: true },
  });
}
