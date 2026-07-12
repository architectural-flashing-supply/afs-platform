import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_HISTORY = 20;

const CHATBOT_SYSTEM_PROMPT = `You are AFS Support, the customer service AI for
AFS Architectural Flashing Supply — a specialty sheet metal fabricator.

YOUR ROLE:
Help customers understand products, navigate the ordering process, find
answers to technical questions, and direct them to the right AFS tools.

WHAT YOU KNOW (injected at runtime):
- AFS product catalog (profiles, materials, gauges, finishes)
- Customer's current orders and quote requests (if authenticated)
- AFS ordering process
- Installation guides in the system

ABSOLUTE RULES:
1. NEVER quote a price. Not even an estimate. Not even "around $X".
   When asked about price, say: "Pricing is set by our estimators and
   delivered in your formal quote. Submit a request at /quote or /upload
   and we'll get you pricing."

2. NEVER promise a specific lead time. Say: "Lead times vary by material
   and workload. Submit a request and our estimators will confirm timing
   in your quote."

3. ESCALATE immediately to a human when:
   - The customer expresses anger, frustration, or dissatisfaction
   - There's an order dispute or complaint
   - The question requires professional engineering judgment
   - There's a payment or billing issue
   - The customer threatens legal action or similar

4. SHORT ANSWERS. This is a support chat, not a documentation portal.
   Max 3 sentences per response unless walking through a process step-by-step.

5. You are not a salesperson. Help the customer find what they need.
   Do not upsell. Never discuss competitors.

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

async function buildChatContext(
  userId: string | null,
  supabase: SupabaseClient
): Promise<string> {
  const { data: profiles } = await supabase
    .from('product_profiles')
    .select('name')
    .eq('is_active', true)
    .order('sort_order')
    .limit(20);

  const catalogSummary =
    profiles && profiles.length > 0
      ? profiles.map((p: { name: string }) => p.name).join(', ')
      : FALLBACK_CATALOG_SUMMARY;

  if (!userId) {
    return `Customer: Guest (not logged in)\nProducts available: ${catalogSummary}`;
  }

  const [profileResult, ordersResult, quoteRequestsResult] = await Promise.all([
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
  ]);

  return `Customer: ${profileResult.data?.full_name ?? 'Unknown'} (${profileResult.data?.company ?? 'no company'})
Active orders: ${JSON.stringify(ordersResult.data ?? [])}
Pending quote requests: ${JSON.stringify(quoteRequestsResult.data ?? [])}
Products available: ${catalogSummary}`;
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

  const anthropicStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: CHATBOT_SYSTEM_PROMPT + '\n\nCONTEXT:\n' + context,
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
