import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';

const MAX_TURNS = 10;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AdvisorRequestBody {
  profileSlug: string;
  profileName: string;
  question: string;
  conversationHistory?: ConversationMessage[];
}

function buildSystemPrompt(profileName: string): string {
  return `You are an installation specialist for AFS Architectural Flashing Supply. Answer technical installation questions about the specific flashing profile the customer is viewing.

CURRENT PROFILE: ${profileName}

STANDARDS REFERENCE:
SMACNA Sheet Metal Manual, current edition
ASTM standards relevant to sheet metal flashing

RULES:
1. Answer installation questions only. Deflect pricing, ordering, or product availability questions to /quote.
2. Recommend professional review for structural calculations or unusual conditions.
3. Cite SMACNA or ASTM when applicable.
4. Be specific. "Follow manufacturer recommendations" is not acceptable.
5. If the question is outside your knowledge, say so directly. Do not guess.
6. NEVER provide information that could be used to bypass a professional engineer.

Keep responses under 200 words unless a step-by-step explanation requires more.`;
}

function isConversationMessage(value: unknown): value is ConversationMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as AdvisorRequestBody | null;
    if (!body || typeof body.question !== 'string' || !body.question.trim()) {
      return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
    }
    if (typeof body.profileSlug !== 'string' || !body.profileSlug.trim()) {
      return NextResponse.json({ error: 'A profile is required.' }, { status: 400 });
    }

    const history = Array.isArray(body.conversationHistory)
      ? body.conversationHistory.filter(isConversationMessage).slice(-MAX_TURNS * 2)
      : [];

    const profileName = body.profileName?.trim() || body.profileSlug;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: buildSystemPrompt(profileName),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: body.question.trim() },
      ],
    });

    const answer = response.content.find((b) => b.type === 'text')?.text ?? '';

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('[Installation Advisor Error]', error);
    return NextResponse.json({ error: 'The advisor is unavailable right now. Please try again.' }, { status: 500 });
  }
}
