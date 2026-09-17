import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPassportUserContext } from '@/lib/data/profile-passport';
import { buildProfilePdf } from '@/lib/utils/profile-pdf';

interface PassportProfileDimensions {
  points?: unknown;
}

/** RLS (profile_passport_select) scopes the row lookup itself; the explicit sign-in check just gives a clean 401 instead of a confusing 404. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const context = await getPassportUserContext(supabase);
    if (!context) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const { data } = await supabase
      .from('saved_configurations')
      .select('id, name, created_at, job_info, dimensions')
      .eq('id', params.id)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const dims = data.dimensions as PassportProfileDimensions | null;
    const points = Array.isArray(dims?.points) ? (dims!.points as { x: number; y: number }[]) : [];
    const jobInfo = data.job_info as { jobName?: string } | null;

    const pdfBytes = await buildProfilePdf({
      name: data.name || 'Untitled Profile',
      jobName: jobInfo?.jobName ?? null,
      createdAt: data.created_at,
      points,
    });

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(data.name || 'profile').replace(/[^a-z0-9-_]+/gi, '-')}.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (error) {
    console.error('[Profile Passport PDF Error]', error);
    return NextResponse.json({ error: 'Could not generate PDF.' }, { status: 500 });
  }
}
