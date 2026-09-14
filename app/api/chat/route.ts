import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchKnowledge } from '@/lib/chatbot/knowledge';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_HISTORY = 20;

const CHATBOT_SYSTEM_PROMPT = `You are FlashChat, the AI assistant for Architectural Flashing Supply, a precision sheet metal fabrication shop in Burnet, Texas. You have deep expertise in architectural sheet metal, Division 7 specifications, and the full AFS product line.

COMPANY: Architectural Flashing Supply, 209 Sure Cast Drive, Burnet TX 78611. Phone: (512) 372-4900. Email: trica@architecturalflashingsupply.com. Owner: Steve Harycki. Texas-made, delivering across North America.

YOUR EXPERTISE — DIVISION 07 FLASHING AND SHEET METAL:
You have comprehensive knowledge of CSI MasterFormat Division 07 — Thermal and Moisture Protection, with specific depth in:

07 60 00 FLASHING AND SHEET METAL:
- 07 61 00 Sheet Metal Roofing — standing seam, batten seam, flat lock, and snap lock systems
- 07 62 00 Sheet Metal Flashing and Trim — base flashing, counter flashing, cap flashing, step flashing, valley flashing, reglets, reveals
- 07 63 00 Sheet Metal Drainage — gutters (box, half-round, K-style), downspouts, conductor heads, scuppers, overflow drains
- 07 65 00 Flexible Flashing — through-wall flashing, window/door pan flashing, self-adhering membranes at metal terminations
- 07 66 00 Sheet Metal Wall Panels — rainscreen panels, reveal panels, soffit panels

07 71 00 ROOF SPECIALTIES:
- Coping caps — material selection, sizing, joint design, expansion provisions
- Gravel stops and fascia — height requirements, overflow provisions, attachment
- Ridge and hip caps — geometry, overlap requirements, fastening
- Pitch pans — installation, fill materials, maintenance

07 72 00 ROOF ACCESSORIES:
- Expansion joints — movement accommodation, cover plate design
- Prefabricated curbs — material compatibility, height requirements

MATERIAL KNOWLEDGE:
Copper: 16oz, 20oz, 24oz designations (oz per sq ft). Develops patina. Incompatible with aluminum and zinc (galvanic corrosion). Use lead-coated copper at masonry. Thermal coefficient 0.0000094/°F. Soldered or mechanical seams. Minimum 16oz for most applications.

Aluminum: .032", .040", .050", .063" common gauges. Lightweight, corrosion resistant, paintable. Not compatible with copper or steel without isolation. Kynar 500/PVDF coatings for color retention. Common for wall panels and fascia.

Galvanized Steel: 24ga, 22ga, 20ga common. G-90 coating minimum for exterior. Heavier than aluminum. Used for cleats, Z-bars, structural applications. Paint or coat for longevity.

Stainless Steel: 304 and 316 grades. 316 for coastal/marine. 28ga-22ga typical. Most expensive but highest durability. Used in high-end or corrosive environments.

Zinc: .027"-.040" common. European standard in US market growth. Natural patina (zinc oxide). Incompatible with copper runoff.

Lead-coated Copper: Copper with terne coating. Traditional masonry flashing. Long service life.

PROFILE KNOWLEDGE — AFS FABRICATES:
Coping Caps, Base Flashing, Counter Flashing, Step Flashing, Valley Flashing, Drip Edge, Gravel Stop, Fascia, Gutter, Downspout, Conductor Head, Scupper, Reglet, Z-Bar/Pitch Change, Z-Closure, Hip Cap, Ridge Cap, Inside Corner, Outside Corner, Window/Door Pan, Expansion Joint Cover, Wall Panels, Custom Profiles via FlashDraft.

CLEAT TYPES AFS FABRICATES:
Flat cleats, standing seam cleats, double-lock cleats, expansion cleats, starter cleats, cap cleats. All are custom geometry — designed in FlashDraft.

INSTALLATION KNOWLEDGE:
- Minimum 3" end laps on all sheet metal flashing
- Thermal expansion: allow 1/8" per 10 feet for copper, 3/16" per 10 feet for aluminum
- Never sandwich dissimilar metals without isolation membrane
- Sealant at terminations: polyurethane or silicone, never caulk alone as primary water barrier
- Through-wall flashing: minimum 4" embed into wall, slope minimum 1/4":12 to drain
- Counterflashing: minimum 4" overlap over base flashing
- Coping cap: minimum 3" each side overhang, slope 1/8":12 minimum to drain water away from wall

ROUTING RULES — CRITICAL:
- NEVER quote a price or lead time
- Any profile — standard or custom geometry, cleat, or complex profile → direct to /studio/draft (FlashDraft)
- Has drawings or photos → direct to /studio (Design Studio — Scan to Quote or Photo to Quote)
- General inquiry, not ready to spec → answer questions, then offer to help specify and route appropriately
- Always offer to connect them with Trica at trica@architecturalflashingsupply.com or (512) 372-4900 for complex projects

ESCALATE when: customer is frustrated, has an order dispute, needs engineering judgment beyond standard practice, mentions legal issues, or asks about billing.

Keep responses concise — 2-4 sentences for simple questions, more detail for technical specifications. Be direct and knowledgeable. You represent a Texas craftsman shop that takes precision seriously.

ESCALATION FORMAT:
When escalation is needed, start your response with this exact marker
before any other text, using valid JSON:
[ESCALATE: {"reason": "brief reason"}]
Then continue with a short message letting the customer know you're
connecting them with the team.`;

interface ChatRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: ChatRequestMessage[];
  conversationId: string;
}

function isChatRequestMessage(value: unknown): value is ChatRequestMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

const ACTIVE_ORDER_STATUSES = ['submitted', 'received', 'in_queue', 'cutting', 'bending', 'qc', 'ready', 'shipped'];
const PENDING_QUOTE_STATUSES = ['submitted', 'reviewing'];

const FALLBACK_CATALOG_SUMMARY =
  'Coping caps, base flashing, counter flashing, step flashing, drip edge, gravel stop, ' +
  'expansion joints — in copper, aluminum, galvanized steel, stainless, and Galvalume.';

// Not a DB-backed table — there is no "company info" table in SCHEMA.md —
// so this mirrors the COMPANY line already in CHATBOT_SYSTEM_PROMPT above.
// Kept as its own context block (rather than relying on the system prompt
// alone) so hours can be filled in here later without touching the prompt.
// Hours are a known, still-unresolved data blocker (see CLAUDE.md's DATA
// BLOCKERS table) — not fabricated here.
const AFS_SHOP_INFO_BLOCK = `AFS shop info:
Architectural Flashing Supply
209 Sure Cast Drive, Burnet, TX 78611
Phone: (512) 372-4900
Email: trica@architecturalflashingsupply.com
Owner: Steve Harycki
Hours: not yet published — direct the customer to call or email.`;

// canonical_profiles' real columns (supabase/migrations/006_canonical_profiles.sql):
// id, name, slug, category, description, blank_width_in, points, bends, tags,
// is_active, sort_order, created_at — there is no profile_type, typical_applications,
// or materials_available column. category and tags are the closest real
// equivalents to profile_type/typical_applications; there is no equivalent at
// all for materials_available (canonical profiles are geometry templates, not
// tied to a specific material), so it's simply omitted below rather than
// fabricated.
interface CanonicalProfileRow {
  name: string;
  description: string | null;
  category: string;
  tags: string[] | null;
}

function formatCanonicalProfilesContext(profiles: CanonicalProfileRow[]): string {
  if (profiles.length === 0) return '';
  return `
AFS CANONICAL PROFILE LIBRARY (${profiles.length} standard profiles):
These are AFS's verified standard profiles available for immediate fabrication:
${profiles
  .map((p) => {
    const applications = p.tags && p.tags.length > 0 ? ` | Applications: ${p.tags.join(', ')}` : '';
    return `- ${p.name} (${p.category}): ${p.description ?? ''}${applications}`;
  })
  .join('\n')}
`;
}

// quote_requests has no submission_type column (see SCHEMA.md TABLE 15) —
// a FlashDraft submission is identified the same way
// app/studio/draft/page.tsx's "My Saved Profiles" does: a line_items entry
// with profileType === 'Custom FlashDraft Profile'.
interface FlashDraftHistoryRow {
  request_number: string;
  submitted_at: string;
  line_items: unknown;
}

function isFlashDraftLineItem(value: unknown): boolean {
  return (
    !!value && typeof value === 'object' && (value as Record<string, unknown>).profileType === 'Custom FlashDraft Profile'
  );
}

async function buildChatContext(
  userId: string | null,
  supabase: SupabaseClient
): Promise<string> {
  const [productProfilesResult, canonicalProfilesResult] = await Promise.all([
    supabase.from('product_profiles').select('name').eq('is_active', true).order('sort_order').limit(20),
    // name, category, description, tags are canonical_profiles' real columns
    // (see the CanonicalProfileRow comment above) — ordered by name ASC.
    supabase
      .from('canonical_profiles')
      .select('name, description, category, tags')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(25),
  ]);

  const catalogSummary =
    productProfilesResult.data && productProfilesResult.data.length > 0
      ? productProfilesResult.data.map((p: { name: string }) => p.name).join(', ')
      : FALLBACK_CATALOG_SUMMARY;

  const canonicalProfilesContext = formatCanonicalProfilesContext(
    (canonicalProfilesResult.data ?? []) as CanonicalProfileRow[]
  );

  if (!userId) {
    return `${AFS_SHOP_INFO_BLOCK}

Customer: Guest (not logged in)
Products available: ${catalogSummary}
${canonicalProfilesContext}`;
  }

  const [profileResult, ordersResult, quoteRequestsResult, flashDraftHistoryResult] = await Promise.all([
    supabase.from('profiles').select('full_name, company').eq('id', userId).single(),
    supabase
      .from('orders')
      .select('order_number, status, created_at')
      .eq('user_id', userId)
      .in('status', ACTIVE_ORDER_STATUSES)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('quote_requests')
      .select('request_number, status, submitted_at')
      .eq('user_id', userId)
      .in('status', PENDING_QUOTE_STATUSES)
      .order('submitted_at', { ascending: false })
      .limit(10),
    supabase
      .from('quote_requests')
      .select('request_number, submitted_at, line_items')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(20),
  ]);

  const flashDraftProfiles = ((flashDraftHistoryResult.data ?? []) as FlashDraftHistoryRow[])
    .filter((row) => (Array.isArray(row.line_items) ? row.line_items : []).some(isFlashDraftLineItem))
    .map((row) => ({ requestNumber: row.request_number, submittedAt: row.submitted_at }));

  return `${AFS_SHOP_INFO_BLOCK}

Customer: ${profileResult.data?.full_name ?? 'Unknown'} (${profileResult.data?.company ?? 'no company'})
Active orders: ${JSON.stringify(ordersResult.data ?? [])}
Pending quote requests: ${JSON.stringify(quoteRequestsResult.data ?? [])}
Saved FlashDraft profiles (from quote request history): ${JSON.stringify(flashDraftProfiles)}
Products available: ${catalogSummary}
${canonicalProfilesContext}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json().catch(() => null)) as ChatRequestBody | null;

  if (!body || !Array.isArray(body.messages) || typeof body.conversationId !== 'string' || !body.conversationId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const messages = body.messages.filter(isChatRequestMessage).slice(-MAX_HISTORY);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'A user message is required' }, { status: 400 });
  }

  const conversationId = body.conversationId;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  let context: string;
  try {
    context = await buildChatContext(userId, supabase);
  } catch (error) {
    console.error('[Chat Context Error]', error);
    context = 'Customer: Guest (not logged in)\nProducts available: ' + FALLBACK_CATALOG_SUMMARY;
  }

  const userQuery = messages[messages.length - 1].content;
  const relevantChunks = searchKnowledge(userQuery);

  const ragContext = relevantChunks.length > 0 ? `
RELEVANT KNOWLEDGE BASE CONTEXT:
The following information from the AFS knowledge base is relevant to this question.
Use it to provide accurate, specific answers:

${relevantChunks.map(chunk => `
[${chunk.category} — ${chunk.topic}]
${chunk.content}
`).join('\n---\n')}

END OF KNOWLEDGE BASE CONTEXT.
` : '';

  const fullSystemPrompt = CHATBOT_SYSTEM_PROMPT + '\n\n' + ragContext;

  const anthropicStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: fullSystemPrompt + '\n\nCONTEXT:\n' + context,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  let fullText = '';

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (error) {
        console.error('[Chat Stream Error]', error);
      } finally {
        controller.close();

        if (userId) {
          const escalated = /^\s*\[ESCALATE:/.test(fullText);
          const admin = createAdminClient();
          const conversationMessages = [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'assistant', content: fullText },
          ];

          try {
            await admin.from('chat_conversations').upsert(
              {
                id: conversationId,
                user_id: userId,
                messages: conversationMessages,
                escalated,
                escalated_at: escalated ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
          } catch (error) {
            console.error('[Chat Persist Error]', error);
          }
        }
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
