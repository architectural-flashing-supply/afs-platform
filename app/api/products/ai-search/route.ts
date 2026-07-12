import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { CATEGORIES, PRODUCTS, STOCK_TYPE_LABEL, type StockType } from '@/lib/data/catalog';

const MAX_HISTORY = 8;
const MAX_PRODUCTS = 3;

interface FinderMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FinderRequestBody {
  query: string;
  conversationHistory?: FinderMessage[];
}

interface FinderProductResult {
  slug: string;
  categorySlug: string;
  name: string;
  materials: string[];
  stockType: StockType;
  reason: string;
}

function isFinderMessage(value: unknown): value is FinderMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

function buildCatalogContext(): string {
  return PRODUCTS.map((p) => {
    const category = CATEGORIES.find((c) => c.slug === p.categorySlug);
    return `- productId: "${p.slug}" | ${p.name} (${category?.name ?? p.categorySlug}) — materials: ${p.materials.join(', ')} — ${STOCK_TYPE_LABEL[p.stockType]} — ${p.description}`;
  }).join('\n');
}

function buildSystemPrompt(): string {
  return `You are a product specialist for AFS Architectural Flashing Supply. Help
customers identify which sheet metal flashing products they need based on their
description.

AVAILABLE PRODUCTS:
${buildCatalogContext()}

PROCESS:
1. Understand what the customer is describing — their words, not technical terms
2. Ask ONE clarifying question if needed (material, building type, location on roof)
3. Never ask more than 2 questions total
4. Present 1-3 product recommendations with plain-language explanations, using the
   exact productId values listed above

NEVER:
- Mention prices
- Make up products not in the catalog
- Provide specific dimensions without the customer providing them first

Return JSON only — no prose, no markdown, no code fences:
{
  "message": "Conversational response to the customer",
  "products": [
    { "productId": "exact-slug-from-catalog-above", "reason": "This is the product because..." }
  ],
  "needsMoreInfo": false,
  "clarifyingQuestion": null
}`;
}

interface ParsedFinderResult {
  message: string;
  products: { productId: string; reason: string }[];
  needsMoreInfo: boolean;
  clarifyingQuestion: string | null;
}

function isParsedProductRef(value: unknown): value is { productId: string; reason: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.productId === 'string' && typeof v.reason === 'string';
}

function parseFinderResult(text: string): ParsedFinderResult {
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean) as Record<string, unknown>;

  if (typeof parsed.message !== 'string') {
    throw new Error('Invalid product finder response.');
  }

  const products = Array.isArray(parsed.products) ? parsed.products.filter(isParsedProductRef) : [];

  return {
    message: parsed.message,
    products,
    needsMoreInfo: Boolean(parsed.needsMoreInfo),
    clarifyingQuestion: typeof parsed.clarifyingQuestion === 'string' ? parsed.clarifyingQuestion : null,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as FinderRequestBody | null;
    if (!body || typeof body.query !== 'string' || !body.query.trim()) {
      return NextResponse.json({ error: 'Describe what you are looking for.' }, { status: 400 });
    }

    const history = Array.isArray(body.conversationHistory)
      ? body.conversationHistory.filter(isFinderMessage).slice(-MAX_HISTORY * 2)
      : [];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: buildSystemPrompt(),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: body.query.trim() },
      ],
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
    const parsed = parseFinderResult(text);

    // Validate every recommended product against the real catalog — never trust
    // the model to have invented a product that doesn't exist.
    const products: FinderProductResult[] = parsed.products
      .map((ref) => {
        const product = PRODUCTS.find((p) => p.slug === ref.productId);
        if (!product) return null;
        return {
          slug: product.slug,
          categorySlug: product.categorySlug,
          name: product.name,
          materials: product.materials,
          stockType: product.stockType,
          reason: ref.reason,
        };
      })
      .filter((p): p is FinderProductResult => p !== null)
      .slice(0, MAX_PRODUCTS);

    return NextResponse.json({
      message: parsed.message,
      products,
      needsMoreInfo: parsed.needsMoreInfo,
      clarifyingQuestion: parsed.clarifyingQuestion,
    });
  } catch (error) {
    console.error('[Product Finder Error]', error);
    return NextResponse.json({ error: 'The product finder is unavailable right now. Please try again.' }, { status: 500 });
  }
}
