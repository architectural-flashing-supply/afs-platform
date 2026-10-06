import { NextRequest, NextResponse } from 'next/server';
import { receiveEmail } from '@/lib/email-intake/pipeline';
import { parseEml } from '@/lib/email-intake/sources/eml';
import { buildProductionDeps, getAdminCaller, hasValidIntakeSecret, MAX_EML_BYTES } from '@/lib/email-intake/server';

// AI takeoff on several attachments can run long. 300 s is the Vercel maximum on Pro.
export const maxDuration = 300;

/**
 * Manual / machine intake of one email as RFC 822 bytes (.eml).
 *   - Admin UI: multipart form with a `file` field.
 *   - Machine callers (a forwarder, Power Automate): POST the raw message with `content-type: message/rfc822`
 *     and header `x-intake-secret: $EMAIL_INTAKE_SECRET`.
 * This is the working front door until the Outlook (Graph) connection exists; both feed the same pipeline.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getAdminCaller();
  if (!admin && !hasValidIntakeSecret(request.headers.get('x-intake-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    let raw: Buffer;
    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'Attach a .eml file in the "file" field.' }, { status: 400 });
      if (file.size > MAX_EML_BYTES) return NextResponse.json({ error: 'Email is larger than 30 MB.' }, { status: 413 });
      raw = Buffer.from(await file.arrayBuffer());
    } else {
      raw = Buffer.from(await request.arrayBuffer());
      if (raw.length > MAX_EML_BYTES) return NextResponse.json({ error: 'Email is larger than 30 MB.' }, { status: 413 });
    }
    if (raw.length < 20) return NextResponse.json({ error: 'Empty message.' }, { status: 400 });

    const email = await parseEml(raw, admin ? 'eml_upload' : 'webhook');
    const outcome = await receiveEmail(email, buildProductionDeps());
    return NextResponse.json(outcome, { status: outcome.status === 'failed' ? 500 : 200 });
  } catch (e) {
    console.error('[Email Intake Error]', e);
    return NextResponse.json({ error: 'Could not process that email.' }, { status: 500 });
  }
}
