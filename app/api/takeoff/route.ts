import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import type Anthropic from '@anthropic-ai/sdk';
import { toFile } from '@anthropic-ai/sdk';
import { anthropic } from '@/lib/anthropic/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { UPLOAD_MAX_PAGES, UPLOAD_MAX_SIZE_BYTES } from '@/lib/utils/upload-limits';
// THE confidence vocabulary this route's system prompt produces — 'high' |
// 'medium' | 'low' per item plus one overall, with a per-item aiNote. It is
// declared in lib/ai/takeoff-confidence.ts rather than here because the
// Command Center V2 Job screen's "What the AI read" panel consumes exactly
// this shape (prompt v2-02's instruction: reuse this pattern, do not invent a
// second one). Importing it here is what keeps the producer and the consumer
// from drifting.
import { isTakeoffConfidence, type TakeoffConfidence } from '@/lib/ai/takeoff-confidence';

// The Messages API has a hard 32MB total request size limit, and base64
// inflates raw bytes by ~33% — so a raw file as small as ~24MB could blow
// that ceiling even while passing both this app's 50MB business limit and
// Vercel's request-size limit. The Files API (500MB per file, well past
// this app's own 50MB cap) avoids that inflation entirely: the file is
// uploaded once to Anthropic and referenced by `file_id` in the Messages
// request instead of being embedded as inline base64 data.
const FILES_API_BETA = 'files-api-2025-04-14' as const;

import { buildTakeoffSystemPrompt, type ScopeOption, type ScopeDirective } from '@/lib/ai/takeoff-prompt';
export type { ScopeOption, ScopeDirective };

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

    // This is the first point in the pipeline where the server holds the
    // real uploaded bytes (the client goes straight to Supabase Storage via
    // a signed upload URL — see app/api/upload/route.ts — so nothing
    // upstream of here has verified actual size or page count against the
    // app's business limits; the client's own checks only guard against a
    // sloppy user, not a byte-accurate one).
    if (buffer.length > UPLOAD_MAX_SIZE_BYTES) {
      await admin
        .from('takeoff_uploads')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', uploadId);
      return NextResponse.json({
        error: `File exceeds ${UPLOAD_MAX_SIZE_BYTES / 1024 / 1024}MB limit. Your file is ${(buffer.length / 1024 / 1024).toFixed(1)}MB.`
      }, { status: 400 });
    }

    if (isPDF) {
      let pageCount: number;
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
      } catch (pdfLoadError) {
        console.error('[Takeoff PDF Parse Error]', pdfLoadError);
        await admin
          .from('takeoff_uploads')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', uploadId);
        return NextResponse.json({
          error: 'Could not read this PDF. It may be corrupted or password-protected.'
        }, { status: 400 });
      }

      if (pageCount > UPLOAD_MAX_PAGES) {
        await admin
          .from('takeoff_uploads')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', uploadId);
        return NextResponse.json({
          error: `PDF exceeds ${UPLOAD_MAX_PAGES} page limit. Your file has ${pageCount} pages.`
        }, { status: 400 });
      }

      await admin
        .from('takeoff_uploads')
        .update({ page_count: pageCount, updated_at: new Date().toISOString() })
        .eq('id', uploadId);
    }

    const mediaType = isPDF ? 'application/pdf' :
      normalizedType === 'png' ? 'image/png' :
      normalizedType === 'webp' ? 'image/webp' : 'image/jpeg';

    // DIAGNOSTIC (temporary — revert once we've seen output): there is no
    // pdfjs-dist text/vector extraction or 300 DPI rasterization branch in
    // this route today. The whole file is uploaded to Anthropic's Files API
    // as one opaque document/image and referenced by file_id — no per-page
    // pipeline to instrument yet.
    console.log('[Takeoff Diagnostic] file', {
      uploadId,
      storageKey,
      fileType: normalizedType,
      isPDF,
      isImage,
      bytes: buffer.length,
    });

    const uploadedFile = await anthropic.beta.files.upload({
      file: await toFile(buffer, storageKey.split('/').pop() || 'upload', { type: mediaType }),
      betas: [FILES_API_BETA],
    });

    const contentBlock: Anthropic.Beta.Messages.BetaContentBlockParam = isPDF
      ? { type: 'document', source: { type: 'file', file_id: uploadedFile.id } }
      : { type: 'image', source: { type: 'file', file_id: uploadedFile.id } };

    const startedAt = Date.now();

    let response: Anthropic.Beta.Messages.BetaMessage;
    try {
      response = await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: buildTakeoffSystemPrompt(scopeDirective),
        betas: [FILES_API_BETA],
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `Analyze this construction drawing file: ${storageKey}. Extract all flashing and sheet metal details.`,
            }
          ],
        }],
      });
    } finally {
      // No reuse case for a given takeoff upload's file once this call
      // returns (no "reprocess" flow reads it again) — delete it either way
      // rather than let it sit against the Files API's 100GB org-wide cap.
      await anthropic.beta.files.delete(uploadedFile.id, { betas: [FILES_API_BETA] }).catch((deleteError) => {
        console.error('[Takeoff Files API] failed to delete uploaded file', { uploadId, fileId: uploadedFile.id, deleteError });
      });
    }

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    const status: 'success' | 'partial' = result.items?.length > 0 ? 'success' : 'partial';
    // Normalised through the SHARED guard rather than trusted raw: the model is
    // told to return high/medium/low, and if it ever returns something else,
    // the column (and every reader of it, including the Job screen's
    // "What the AI read" highlight) should see an honest 'low' rather than an
    // unrecognised string that silently reads as confident.
    const overallConfidence: TakeoffConfidence = isTakeoffConfidence(result.overallConfidence)
      ? result.overallConfidence
      : 'low';
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
        overall_confidence: overallConfidence,
        processing_notes: result.processingNotes ?? null,
        processing_ms: processingMs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uploadId);

    return NextResponse.json({
      items: result.items ?? [],
      overallConfidence,
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
