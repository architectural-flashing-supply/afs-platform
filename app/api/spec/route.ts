import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSpecSection, type SpecWriterInput } from '@/lib/anthropic/spec';

interface SpecGenerateBody {
  csiSection?: string;
  csiTitle?: string;
  profiles?: string[];
  materials?: string[];
  projectType?: string | null;
  climateZone?: string | null;
  soleSource?: boolean;
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

    const body = (await request.json().catch(() => null)) as SpecGenerateBody | null;
    const csiSection = body?.csiSection?.trim();
    const csiTitle = body?.csiTitle?.trim();
    const profiles = Array.isArray(body?.profiles)
      ? body!.profiles.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];
    const materials = Array.isArray(body?.materials)
      ? body!.materials.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];

    if (!csiSection || !csiTitle) {
      return NextResponse.json({ error: 'A CSI section is required.' }, { status: 400 });
    }
    if (profiles.length === 0) {
      return NextResponse.json({ error: 'Select at least one AFS profile.' }, { status: 400 });
    }
    if (materials.length === 0) {
      return NextResponse.json({ error: 'Select at least one material.' }, { status: 400 });
    }

    const input: SpecWriterInput = {
      csiSection,
      csiTitle,
      profiles,
      materials,
      projectType: body?.projectType?.trim() || null,
      climateZone: body?.climateZone?.trim() || null,
      soleSource: Boolean(body?.soleSource),
    };

    const spec = await generateSpecSection(input);
    return NextResponse.json({ spec });
  } catch (error) {
    console.error('[Spec Writer Error]', error);
    return NextResponse.json({ error: 'Specification generation failed. Please try again.' }, { status: 500 });
  }
}
