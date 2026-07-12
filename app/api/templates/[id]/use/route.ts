import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface UseTemplateResponse {
  redirectUrl: string;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

    const { data: template } = await supabase
      .from('quote_templates')
      .select('id, user_id, company_id, is_company_shared, use_count')
      .eq('id', params.id)
      .maybeSingle();

    const hasAccess =
      template &&
      (template.user_id === user.id ||
        (template.is_company_shared && template.company_id && template.company_id === profile?.company_id));

    if (!hasAccess || !template) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
    }

    const { error } = await supabase
      .from('quote_templates')
      .update({ use_count: (template.use_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', params.id);

    if (error) {
      console.error('[Template Use Error]', error);
    }

    const response: UseTemplateResponse = { redirectUrl: `/quote?step=4&from_template=${params.id}` };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Template Use Error]', error);
    return NextResponse.json({ error: 'Could not load template. Please try again.' }, { status: 500 });
  }
}
