import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ProjectCreateBody {
  name?: string;
  description?: string;
  jobsiteAddress?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as ProjectCreateBody | null;
    const name = body?.name?.trim() ?? '';
    if (!name || name.length > 100) {
      return NextResponse.json({ error: 'Project name is required (max 100 characters).' }, { status: 400 });
    }

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        company_id: profile?.company_id ?? null,
        name,
        description: body?.description?.trim() || null,
        jobsite_address: body?.jobsiteAddress?.trim() || null,
        status: 'active',
      })
      .select('id')
      .single();

    if (error || !project) {
      console.error('[Project Create Error]', error);
      return NextResponse.json({ error: 'Could not create project. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ id: project.id });
  } catch (error) {
    console.error('[Project Create Error]', error);
    return NextResponse.json({ error: 'Could not create project. Please try again.' }, { status: 500 });
  }
}
