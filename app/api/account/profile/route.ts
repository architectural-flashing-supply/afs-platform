import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ProfileUpdateBody {
  fullName?: string;
  company?: string;
  phone?: string;
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

    const body = (await request.json().catch(() => null)) as ProfileUpdateBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const fullName = body.fullName?.trim();
    if (fullName !== undefined && fullName.length < 2) {
      return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 });
    }

    const updates: Record<string, string | null> = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (body.company !== undefined) updates.company = body.company.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) {
      console.error('[Profile Update Error]', error);
      return NextResponse.json({ error: 'Could not update profile. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Profile Update Error]', error);
    return NextResponse.json({ error: 'Could not update profile. Please try again.' }, { status: 500 });
  }
}
