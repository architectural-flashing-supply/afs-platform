import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';

const TAKEOFF_SYSTEM_PROMPT = `You are a construction drawing analyzer for AFS Architectural Flashing Supply, a sheet metal fabricator. Your job is to read architectural drawings and extract all flashing and sheet metal details into a structured specification.

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fileBase64, fileType, filename } = await request.json();

    if (!fileBase64 || !fileType) {
      return NextResponse.json({ error: 'Missing file data' }, { status: 400 });
    }

    // Determine media type for Claude
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(fileType.replace('.', ''));
    const isPDF = fileType === '.pdf';

    if (!isImage && !isPDF) {
      return NextResponse.json({
        items: [],
        processingNotes: `${fileType.toUpperCase()} files require conversion. Please upload as PDF or image for AI analysis.`,
        overallConfidence: 'low',
        status: 'partial'
      });
    }

    const mediaType = isPDF ? 'application/pdf' :
      fileType === '.png' ? 'image/png' :
      fileType === '.webp' ? 'image/webp' : 'image/jpeg';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: TAKEOFF_SYSTEM_PROMPT,
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
            text: `Analyze this construction drawing file: ${filename}. Extract all flashing and sheet metal details.`,
          }
        ],
      }],
    });

    const text = response.content.find(b => b.type === 'text')?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return NextResponse.json({
      ...result,
      status: result.items?.length > 0 ? 'success' : 'partial',
    });

  } catch (error) {
    console.error('[Takeoff Error]', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}