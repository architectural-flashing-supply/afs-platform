import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface NotificationUpdateBody {
  emailOptIn?: boolean;
  smsOptIn?: boolean;
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as NotificationUpdateBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const updates: Record<string, boolean | string> = {};
    if (typeof body.emailOptIn === 'boolean') updates.email_opt_in = body.emailOptIn;
    if (typeof body.smsOptIn === 'boolean') updates.sms_opt_in = body.smsOptIn;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) {
      console.error('[Notification Preferences Update Error]', error);
      return NextResponse.json({ error: 'Could not update preferences. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notification Preferences Update Error]', error);
    return NextResponse.json({ error: 'Could not update preferences. Please try again.' }, { status: 500 });
  }
}
