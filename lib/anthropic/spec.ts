import { anthropic } from './client';

export interface SpecArticle {
  number: string;
  title: string;
  content: string;
}

export interface SpecPart {
  title: string;
  articles: SpecArticle[];
}

export interface SpecSection {
  csiSection: string;
  csiTitle: string;
  part1: SpecPart;
  part2: SpecPart;
  part3: SpecPart;
}

export interface SpecWriterInput {
  csiSection: string;
  csiTitle: string;
  profiles: string[];
  materials: string[];
  projectType: string | null;
  climateZone: string | null;
  soleSource: boolean;
}

const SPEC_WRITER_SYSTEM_PROMPT = `You are a construction specification writer specializing in CSI MasterFormat Division 07 sheet metal flashing for AFS Architectural Flashing Supply.

Generate complete, professionally formatted CSI three-part specifications usable in contract documents.

FORMAT:
- CSI three-part format: PART 1 GENERAL, PART 2 PRODUCTS, PART 3 EXECUTION
- Imperative voice in PART 3: "Install flashing in accordance with..."
- Indicative voice in PART 2: "Provide sheet metal flashing as follows..."
- Numbered articles: 1.01, 1.02, 2.01, etc.
- Include generic SMACNA Architectural Sheet Metal Manual and applicable ASTM references in PART 1 — exact edition and reference numbers are pending AFS confirmation, so use standard generic citations only.

AFS RULES:
- AFS Architectural Flashing Supply is the named manufacturer in all PART 2 product references.
- Use the exact AFS profile names provided in the request.
- Warranty language (an article in PART 1): warranty specifics are pending AFS confirmation — use generic placeholder language such as "Manufacturer's standard warranty against defects in material and workmanship. See AFS for current warranty terms."
- If sole source is requested, specify AFS exclusively with no "or-equal" language. If sole source is not requested, use standard "or-equal" substitution language naming AFS as the basis of design.

Return JSON only — no prose, no markdown, no code fences:
{
  "csiSection": "07 62 00",
  "csiTitle": "Sheet Metal Flashing and Trim",
  "part1": {
    "title": "GENERAL",
    "articles": [
      { "number": "1.01", "title": "SUMMARY", "content": "..." },
      { "number": "1.02", "title": "REFERENCES", "content": "..." },
      { "number": "1.03", "title": "SUBMITTALS", "content": "..." },
      { "number": "1.04", "title": "WARRANTY", "content": "..." }
    ]
  },
  "part2": {
    "title": "PRODUCTS",
    "articles": [
      { "number": "2.01", "title": "MANUFACTURERS", "content": "..." },
      { "number": "2.02", "title": "MATERIALS", "content": "..." },
      { "number": "2.03", "title": "FABRICATION", "content": "..." }
    ]
  },
  "part3": {
    "title": "EXECUTION",
    "articles": [
      { "number": "3.01", "title": "EXAMINATION", "content": "..." },
      { "number": "3.02", "title": "INSTALLATION", "content": "..." },
      { "number": "3.03", "title": "CLEANING AND PROTECTION", "content": "..." }
    ]
  }
}`;

function buildSpecUserMessage(input: SpecWriterInput): string {
  const lines = [
    `CSI Section: ${input.csiSection} — ${input.csiTitle}`,
    `AFS profiles to specify: ${input.profiles.join(', ')}`,
    `Materials: ${input.materials.join(', ')}`,
  ];
  if (input.projectType) lines.push(`Project type: ${input.projectType}`);
  if (input.climateZone) lines.push(`Climate zone / exposure: ${input.climateZone}`);
  lines.push(
    input.soleSource
      ? 'Sole source: Specify AFS exclusively — no substitution language.'
      : 'Sole source: Allow substitutions — use "or-equal" basis-of-design language naming AFS.'
  );
  return lines.join('\n');
}

function isSpecArticle(value: unknown): value is SpecArticle {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.number === 'string' && typeof v.title === 'string' && typeof v.content === 'string';
}

function isSpecPart(value: unknown): value is SpecPart {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === 'string' && Array.isArray(v.articles) && v.articles.every(isSpecArticle);
}

function validateSpecSection(parsed: unknown): SpecSection {
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid specification response.');
  const v = parsed as Record<string, unknown>;
  if (
    typeof v.csiSection !== 'string' ||
    typeof v.csiTitle !== 'string' ||
    !isSpecPart(v.part1) ||
    !isSpecPart(v.part2) ||
    !isSpecPart(v.part3)
  ) {
    throw new Error('Invalid specification response.');
  }
  return {
    csiSection: v.csiSection,
    csiTitle: v.csiTitle,
    part1: v.part1,
    part2: v.part2,
    part3: v.part3,
  };
}

export async function generateSpecSection(input: SpecWriterInput): Promise<SpecSection> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SPEC_WRITER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildSpecUserMessage(input) }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return validateSpecSection(parsed);
}
