import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { ACCESSORIES } from '@/lib/data/catalog';

const MAX_SUGGESTIONS = 2;

interface CrossSellRequestBody {
  profileTypes?: unknown;
  materials?: unknown;
}

interface RawSuggestion {
  accessory: string;
  reason: string;
}

function isRawSuggestion(value: unknown): value is RawSuggestion {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.accessory === 'string' && typeof v.reason === 'string';
}

function buildSystemPrompt(lineItemSummary: string): string {
  const accessoryCatalog = ACCESSORIES.map((a) => `- ${a.name} (${a.category})`).join('\n');

  return `You are an AFS Architectural Flashing Supply product advisor. A contractor
is building a quote request and may have forgotten important accessories.

THEIR ORDER:
${lineItemSummary}

AVAILABLE ACCESSORIES IN OUR CATALOG:
${accessoryCatalog}

Based on their specific combination of profiles and materials, identify
1-2 accessories they likely forgot that would be critical for installation.

RULES:
- Only suggest accessories actually in our catalog, using the exact name listed above
- Only suggest what is genuinely needed — not everything we sell
- Plain language explanation of why they need it
- No prices
- If nothing important is missing, output { "suggestions": [] }

Return JSON only — no prose, no markdown, no code fences:
{
  "suggestions": [
    { "accessory": "exact accessory name from the list above", "reason": "One sentence why they need this for their specific order" }
  ]
}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as CrossSellRequestBody | null;
    const profileTypes = Array.isArray(body?.profileTypes)
      ? body!.profileTypes.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];
    const materials = Array.isArray(body?.materials)
      ? body!.materials.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];

    if (profileTypes.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const lineItemSummary = `Profiles: ${profileTypes.join(', ')}\nMaterials: ${
      materials.length > 0 ? materials.join(', ') : 'not specified'
    }`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: buildSystemPrompt(lineItemSummary),
      messages: [{ role: 'user', content: 'Suggest accessories for this order.' }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;

    const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const accessoryNames = new Set(ACCESSORIES.map((a) => a.name));
    const suggestions = raw.filter(isRawSuggestion).filter((s) => accessoryNames.has(s.accessory)).slice(0, MAX_SUGGESTIONS);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[Cross-Sell Recommendation Error]', error);
    return NextResponse.json({ suggestions: [] });
  }
}
