import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSimplePdf, type SimplePdfLine } from '@/lib/utils/simple-pdf';

interface FinishRow {
  name: string;
  manufacturer: string | null;
  color_code: string | null;
  hex_preview: string | null;
  is_standard: boolean;
  upcharge_pct: number;
}

function formatUpcharge(row: FinishRow): string {
  if (row.is_standard || row.upcharge_pct <= 0) return 'Standard';
  return `+${(row.upcharge_pct * 100).toFixed(1)}%`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { materialSlug: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    const { data: material } = await supabase
      .from('materials')
      .select('id, name, slug')
      .eq('slug', params.materialSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (!material) {
      return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
    }

    const { data: finishesRaw } = await supabase
      .from('finishes')
      .select('name, manufacturer, color_code, hex_preview, is_standard, upcharge_pct')
      .eq('material_id', material.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    const finishes = (finishesRaw ?? []) as FinishRow[];

    const lines: SimplePdfLine[] = [];
    lines.push({ text: 'AFS — Architectural Flashing Supply', font: 'bold', size: 16 });
    lines.push({ text: `${material.name} Finish Palette`, font: 'bold', size: 14, spaceBefore: 4 });
    lines.push({
      text: `Generated ${new Date().toISOString().split('T')[0]}`,
      size: 9,
      spaceBefore: 4,
    });

    if (finishes.length === 0) {
      lines.push({ text: 'No finishes published for this material yet.', size: 10, spaceBefore: 18 });
    } else {
      lines.push({
        text: 'Name                          Manufacturer        Code            Hex        Upcharge',
        font: 'mono',
        size: 9,
        spaceBefore: 18,
      });
      for (const f of finishes) {
        lines.push({
          text: `${f.name.slice(0, 29).padEnd(30)} ${(f.manufacturer ?? '—').slice(0, 18).padEnd(19)} ${(f.color_code ?? '—')
            .slice(0, 14)
            .padEnd(15)} ${(f.hex_preview ?? '—').padEnd(10)} ${formatUpcharge(f)}`,
          font: 'mono',
          size: 8,
        });
      }
    }

    lines.push({
      text: 'For design review only — actual color may vary. Order samples before specifying.',
      size: 9,
      spaceBefore: 18,
    });
    lines.push({ text: 'Request samples: /contact', size: 8, spaceBefore: 4 });

    const pdfBuffer = buildSimplePdf(lines);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="afs-${material.slug}-finish-palette.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('[Finish Palette PDF Error]', error);
    return NextResponse.json({ error: 'Could not generate palette PDF.' }, { status: 500 });
  }
}
