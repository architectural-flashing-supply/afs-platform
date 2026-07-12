import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SpecPart } from '@/lib/anthropic/spec';

interface SpecSaveBody {
  csiSection?: string;
  csiTitle?: string;
  part1?: SpecPart;
  part2?: SpecPart;
  part3?: SpecPart;
  isSoleSource?: boolean;
  projectId?: string | null;
}

function isValidPart(part: unknown): part is SpecPart {
  if (!part || typeof part !== 'object') return false;
  const v = part as Record<string, unknown>;
  return typeof v.title === 'string' && Array.isArray(v.articles);
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

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'architect' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'This feature requires an architect account.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as SpecSaveBody | null;
    if (
      !body?.csiSection?.trim() ||
      !body?.csiTitle?.trim() ||
      !isValidPart(body.part1) ||
      !isValidPart(body.part2) ||
      !isValidPart(body.part3)
    ) {
      return NextResponse.json({ error: 'Incomplete specification data.' }, { status: 400 });
    }

    const { data: saved, error } = await supabase
      .from('saved_specifications')
      .insert({
        user_id: user.id,
        project_id: body.projectId ?? null,
        csi_section: body.csiSection.trim(),
        csi_title: body.csiTitle.trim(),
        spec_data: { part1: body.part1, part2: body.part2, part3: body.part3 },
        is_sole_source: Boolean(body.isSoleSource),
        version: 1,
      })
      .select('id')
      .single();

    if (error || !saved) {
      console.error('[Spec Save Error]', error);
      return NextResponse.json({ error: 'Could not save specification. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ id: saved.id });
  } catch (error) {
    console.error('[Spec Save Error]', error);
    return NextResponse.json({ error: 'Could not save specification. Please try again.' }, { status: 500 });
  }
}
