import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const orderReference = typeof body.orderReference === 'string' ? body.orderReference.trim() : null;

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'Project details are required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = createAdminClient();
    const requestId = crypto.randomUUID();

    const descriptionLines = [orderReference ? `Order reference: ${orderReference}` : null, message].filter(
      Boolean
    );

    const { error: insertError } = await admin.from('consultation_requests').insert({
      id: requestId,
      user_id: user?.id ?? null,
      name,
      email,
      phone,
      topic: 'General Inquiry',
      description: descriptionLines.join('\n\n'),
      preferred_contact: 'Email',
      status: 'new',
    });

    if (insertError) {
      console.error('[Contact Insert Error]', insertError);
      return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ id: requestId });
  } catch (error) {
    console.error('[Contact Request Error]', error);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}
