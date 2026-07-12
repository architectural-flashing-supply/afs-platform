import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { ALL_MATERIALS, MATERIAL_STOCK_STATUS, STOCK_TYPE_LABEL, type StockType } from '@/lib/data/catalog';

const MAX_ALTERNATIVES = 2;

interface MaterialRecRequestBody {
  material: string;
  profileType: string;
  stockStatus: StockType;
}

interface MaterialAlternative {
  material: string;
  stockStatus: StockType;
  reason: string;
}

function isKnownMaterial(name: string): boolean {
  return (ALL_MATERIALS as readonly string[]).includes(name);
}

function isRawAlternative(value: unknown): value is { material: string; reason: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.material === 'string' && typeof v.reason === 'string';
}

function buildSystemPrompt(material: string, profileType: string, stockStatus: StockType): string {
  const availableMaterials = ALL_MATERIALS.filter((m) => m !== material)
    .map((m) => `- ${m} (${STOCK_TYPE_LABEL[MATERIAL_STOCK_STATUS[m] ?? 'fabricated']})`)
    .join('\n');

  return `You are a sheet metal fabrication specialist for AFS Architectural Flashing Supply.

A customer has selected: ${material} for ${profileType}.
Current stock status: ${STOCK_TYPE_LABEL[stockStatus]}

CATALOG CONTEXT (available alternatives):
${availableMaterials}

Recommend up to 2 alternative materials if the selected material has
availability issues OR if the material is not ideal for this application.
If the selection is fine, recommend no alternatives.

RULES:
- Only recommend materials actually listed above, using the exact name shown
- Plain language — no jargon the customer might not understand
- Never mention price
- If selection is standard and available: output { "recommend": false }

Return JSON only — no prose, no markdown, no code fences:
{
  "recommend": true,
  "message": "1-2 sentence explanation of the situation",
  "alternatives": [
    { "material": "exact material name from the list above", "reason": "One sentence why this is a good alternative" }
  ]
}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as MaterialRecRequestBody | null;
    if (!body || typeof body.material !== 'string' || !body.material.trim()) {
      return NextResponse.json({ error: 'A material is required.' }, { status: 400 });
    }
    if (typeof body.profileType !== 'string' || !body.profileType.trim()) {
      return NextResponse.json({ error: 'A profile type is required.' }, { status: 400 });
    }

    const stockStatus: StockType =
      body.stockStatus === 'stock' || body.stockStatus === 'fabricated' || body.stockStatus === 'special_order'
        ? body.stockStatus
        : 'fabricated';

    if (stockStatus !== 'special_order') {
      return NextResponse.json({ recommend: false, message: '', alternatives: [] });
    }

    const material = body.material.trim();
    const profileType = body.profileType.trim();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: buildSystemPrompt(material, profileType, stockStatus),
      messages: [{ role: 'user', content: `Selected material: ${material}` }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;

    const rawAlternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
    const alternatives: MaterialAlternative[] = rawAlternatives
      .filter(isRawAlternative)
      .filter((a) => isKnownMaterial(a.material))
      .slice(0, MAX_ALTERNATIVES)
      .map((a) => ({
        material: a.material,
        stockStatus: MATERIAL_STOCK_STATUS[a.material] ?? 'fabricated',
        reason: a.reason,
      }));

    return NextResponse.json({
      recommend: Boolean(parsed.recommend) && alternatives.length > 0,
      message: typeof parsed.message === 'string' ? parsed.message : '',
      alternatives,
    });
  } catch (error) {
    console.error('[Material Recommendation Error]', error);
    return NextResponse.json({ recommend: false, message: '', alternatives: [] });
  }
}
