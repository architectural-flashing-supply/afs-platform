import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { anthropic } from '@/lib/anthropic/client';
import { createAdminClient } from '@/lib/supabase/admin';

export type ScopeOption = 'full' | 'roof' | 'flashing' | 'roof_flashing' | 'custom';

export interface ScopeDirective {
  option: ScopeOption;
  customText?: string;
}

const SCOPE_CONSTRAINT_TEXT: Record<Exclude<ScopeOption, 'full' | 'custom'>, string> = {
  roof: 'Only extract items related to roofing systems. Do not extract flashing, coping, or other sheet metal details unless they are integral roofing components. If the drawing contains other categories, note what was excluded and why in processingNotes.',
  flashing: 'Only extract flashing and sheet metal component items (coping caps, base flashing, counter flashing, step flashing, drip edge, gravel stop, expansion joints, reglets, through-wall flashing, valley flashing). Do not extract roofing membrane, decking, or other non-flashing roofing systems. If the drawing contains other categories, note what was excluded and why in processingNotes.',
  roof_flashing: 'Extract both roofing system items and flashing/sheet metal component items. Do not extract unrelated categories (structural framing, MEP, glazing, etc.) unless they are integral to a roofing or flashing assembly. If the drawing contains other categories, note what was excluded and why in processingNotes.',
};

function buildScopeConstraintBlock(scopeDirective?: ScopeDirective): string {
  if (!scopeDirective || scopeDirective.option === 'full') return '';

  if (scopeDirective.option === 'custom') {
    const customText = (scopeDirective.customText ?? '').trim();
    if (!customText) return '';
    return `\nSCOPE_CONSTRAINT — read before extracting:\nThis constraint LIMITS what you extract from the drawing; it does not expand the categories listed below. Only extract items matching the following user-specified scope: "${customText}". If the drawing contains items outside this scope, note what was excluded and why in processingNotes.\n\n`;
  }

  return `\nSCOPE_CONSTRAINT — read before extracting:\n${SCOPE_CONSTRAINT_TEXT[scopeDirective.option]}\n\n`;
}

const TAKEOFF_SYSTEM_PROMPT_INTRO = `You are a construction drawing analyzer for AFS Architectural Flashing Supply, a sheet metal fabricator. Your job is to read architectural drawings and extract all flashing and sheet metal details into a structured specification.
`;

const TAKEOFF_SYSTEM_PROMPT_RULES = `
PROFILE TYPES TO IDENTIFY:
- Coping Cap (parapet cap) — note width, height, leg lengths
- Base Flashing — note height, leg lengths
- Counter Flashing — note height, lap dimension
- Step Flashing — note width, length per piece
- Drip Edge — note leg lengths, subtype (D-style, L-style, T-style)
- Gravel Stop — note height, leg length
- Valley Flashing — note width
- Expansion Joint Cover — note width
- Reglet — note depth
- Through-wall Flashing — note width, projection

FOR EACH ITEM EXTRACT:
1. Profile type (from list above)
2. Material if specified (copper, aluminum, galvanized steel, stainless, Galvalume)
3. Gauge or weight if specified
4. Dimensions in INCHES: Width, Height, Leg A, Leg B
5. Length in LINEAR FEET
6. Quantity — count of pieces or sections
7. Confidence: high, medium, or low
8. Note the drawing sheet and detail reference if visible

RETURN ONLY valid JSON, no prose, no markdown, no code fences:
{
  "items": [
    {
      "profileType": "Coping Cap",
      "material": "Galvanized Steel",
      "gauge": "20 ga",
      "finish": null,
      "width": 12,
      "height": 4,
      "legA": 3,
      "legB": 3,
      "lengthFt": 48,
      "quantity": 1,
      "unit": "LF",
      "confidence": "high",
      "aiNote": "North parapet, sheet A3.1 detail 5"
    }
  ],
  "processingNotes": "Brief note about what was processed",
  "overallConfidence": "medium"
}

If no flashing details found: { "items": [], "processingNotes": "No flashing details identified.", "overallConfidence": "low" }`;

function buildTakeoffSystemPrompt(scopeDirective?: ScopeDirective): string {
  return TAKEOFF_SYSTEM_PROMPT_INTRO + buildScopeConstraintBlock(scopeDirective) + TAKEOFF_SYSTEM_PROMPT_RULES;
}

interface TakeoffRequestBody {
  uploadId: string;
  storageKey: string;
  fileType: string;
  scopeDirective?: ScopeDirective;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = createAdminClient();
  let uploadId: string | undefined;

  try {
    const body: TakeoffRequestBody = await request.json();
    uploadId = body.uploadId;
    const { storageKey, fileType, scopeDirective } = body;

    if (!uploadId || !storageKey || !fileType) {
      return NextResponse.json({ error: 'Missing uploadId, storageKey, or fileType' }, { status: 400 });
    }

    await admin
      .from('takeoff_uploads')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', uploadId);

    const normalizedType = fileType.replace('.', '').toLowerCase();
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(normalizedType);
    const isPDF = normalizedType === 'pdf';

    if (!isImage && !isPDF) {
      const processingNotes = `${fileType.toUpperCase()} files require conversion. Please upload as PDF or image for AI analysis.`;

      await admin
        .from('takeoff_uploads')
        .update({
          status: 'partial',
          result_items: [],
          processing_notes: processingNotes,
          overall_confidence: 'low',
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadId);

      return NextResponse.json({
        items: [],
        overallConfidence: 'low',
        pagesProcessed: 0,
        processingNotes,
        status: 'partial',
        scopeDirective: scopeDirective ?? null,
      });
    }

    const { data: fileBlob, error: downloadError } = await admin.storage
      .from('blueprints')
      .download(storageKey);

    if (downloadError || !fileBlob) {
      console.error('[Takeoff Download Error]', downloadError);
      await admin
        .from('takeoff_uploads')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', uploadId);
      return NextResponse.json({ error: 'Could not retrieve uploaded file' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const fileBase64 = buffer.toString('base64');

    const mediaType = isPDF ? 'application/pdf' :
      normalizedType === 'png' ? 'image/png' :
      normalizedType === 'webp' ? 'image/webp' : 'image/jpeg';

    // DIAGNOSTIC (temporary — revert once we've seen output): there is no
    // pdfjs-dist text/vector extraction or 300 DPI rasterization branch in
    // this route today. The whole file is base64-encoded and handed to
    // Claude's document API as a single opaque block. These logs show what
    // that actually looks like per request, not per page, since there is no
    // per-page pipeline to instrument yet.
    console.log('[Takeoff Diagnostic] file', {
      uploadId,
      storageKey,
      fileType: normalizedType,
      isPDF,
      isImage,
      bytes: buffer.length,
    });

    if (isPDF) {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        console.log('[Takeoff Diagnostic] pdf page count', {
          uploadId,
          pageCount: pdfDoc.getPageCount(),
        });
      } catch (pdfLoadError) {
        console.log('[Takeoff Diagnostic] pdf page count unavailable (load failed)', {
          uploadId,
          error: pdfLoadError instanceof Error ? pdfLoadError.message : String(pdfLoadError),
        });
      }
    }

    const startedAt = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: buildTakeoffSystemPrompt(scopeDirective),
      messages: [{
        role: 'user',
        content: [
          {
            type: isPDF ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: fileBase64,
            },
          } as any,
          {
            type: 'text',
            text: `Analyze this construction drawing file: ${storageKey}. Extract all flashing and sheet metal details.`,
          }
        ],
      }],
    });

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    const status: 'success' | 'partial' = result.items?.length > 0 ? 'success' : 'partial';
    const processingMs = Date.now() - startedAt;

    // DIAGNOSTIC (temporary — revert once we've seen output): logs what the
    // model actually produced from the raw file (no branch/char-count/raster
    // fields since there's no extraction step upstream to report on).
    console.log('[Takeoff Diagnostic] claude response', {
      uploadId,
      processingMs,
      responseCharCount: text.length,
      responseFirst500: text.slice(0, 500),
      itemCount: result.items?.length ?? 0,
      overallConfidence: result.overallConfidence ?? null,
      status,
    });

    await admin
      .from('takeoff_uploads')
      .update({
        status: status === 'success' ? 'complete' : 'partial',
        result_items: result.items ?? [],
        overall_confidence: result.overallConfidence ?? null,
        processing_notes: result.processingNotes ?? null,
        processing_ms: processingMs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uploadId);

    return NextResponse.json({
      items: result.items ?? [],
      overallConfidence: result.overallConfidence ?? 'low',
      pagesProcessed: 1,
      processingNotes: result.processingNotes ?? null,
      status,
      scopeDirective: scopeDirective ?? null,
    });

  } catch (error) {
    console.error('[Takeoff Error]', error);
    if (uploadId) {
      await admin
        .from('takeoff_uploads')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', uploadId);
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
