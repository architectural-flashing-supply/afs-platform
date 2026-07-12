import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ProjectUpdateBody {
  name?: string;
  description?: string;
  jobsiteAddress?: string;
  status?: 'active' | 'completed' | 'archived';
}

const VALID_STATUSES = ['active', 'completed', 'archived'];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as ProjectUpdateBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const updates: Record<string, string | null> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length > 100) {
        return NextResponse.json({ error: 'Project name is required (max 100 characters).' }, { status: 400 });
      }
      updates.name = name;
    }
    if (body.description !== undefined) updates.description = body.description.trim() || null;
    if (body.jobsiteAddress !== undefined) updates.jobsite_address = body.jobsiteAddress.trim() || null;
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('projects').update(updates).eq('id', params.id);
    if (error) {
      console.error('[Project Update Error]', error);
      return NextResponse.json({ error: 'Could not update project. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Project Update Error]', error);
    return NextResponse.json({ error: 'Could not update project. Please try again.' }, { status: 500 });
  }
}
