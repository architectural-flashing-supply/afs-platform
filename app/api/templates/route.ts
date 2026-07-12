import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TemplateItemInput {
  profileType: string;
  material?: string;
  lengthFt: number;
  quantity: number;
}

interface TemplateCreateBody {
  name?: string;
  description?: string;
  isCompanyShared?: boolean;
  items?: TemplateItemInput[];
}

function isValidItem(item: unknown): item is TemplateItemInput {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.profileType === 'string' &&
    i.profileType.trim().length > 0 &&
    typeof i.lengthFt === 'number' &&
    i.lengthFt > 0 &&
    typeof i.quantity === 'number' &&
    i.quantity > 0
  );
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

    const body = (await request.json().catch(() => null)) as TemplateCreateBody | null;
    const name = body?.name?.trim() ?? '';
    if (!name) {
      return NextResponse.json({ error: 'Template name is required.' }, { status: 400 });
    }

    const items = (body?.items ?? []).filter(isValidItem);
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Each item requires a profile type, length, and quantity.' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
    const isCompanyShared = Boolean(body?.isCompanyShared) && Boolean(profile?.company_id);

    const { data: template, error } = await supabase
      .from('quote_templates')
      .insert({
        user_id: user.id,
        company_id: profile?.company_id ?? null,
        name,
        description: body?.description?.trim() || null,
        is_company_shared: isCompanyShared,
        items,
      })
      .select('id')
      .single();

    if (error || !template) {
      console.error('[Template Create Error]', error);
      return NextResponse.json({ error: 'Could not save template. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ id: template.id });
  } catch (error) {
    console.error('[Template Create Error]', error);
    return NextResponse.json({ error: 'Could not save template. Please try again.' }, { status: 500 });
  }
}
