import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, PageNumber, convertInchesToTwip, HeadingLevel } from 'docx';
import { createClient } from '@/lib/supabase/server';
import type { SpecPart } from '@/lib/anthropic/spec';

interface SavedSpecRow {
  id: string;
  csi_section: string;
  csi_title: string;
  spec_data: { part1: SpecPart; part2: SpecPart; part3: SpecPart };
  is_sole_source: boolean;
}

function buildPartParagraphs(label: string, part: SpecPart): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 360, after: 200 },
      children: [new TextRun({ text: `${label} — ${part.title}`, bold: true, size: 26, font: 'Times New Roman' })],
    }),
  ];

  for (const article of part.articles) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({ text: `${article.number}  `, bold: true, size: 22, font: 'Times New Roman' }),
          new TextRun({ text: article.title, bold: true, size: 22, font: 'Times New Roman' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: article.content, size: 22, font: 'Times New Roman' })],
      })
    );
  }

  return paragraphs;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: spec } = await supabase
      .from('saved_specifications')
      .select('id, csi_section, csi_title, spec_data, is_sole_source')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!spec) {
      return NextResponse.json({ error: 'Specification not found.' }, { status: 404 });
    }

    const row = spec as SavedSpecRow;
    const { part1, part2, part3 } = row.spec_data;

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'AFS — ARCHITECTURAL FLASHING SUPPLY', bold: true, size: 18, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'DRAFT — VERIFY WITH AFS BEFORE USE IN CONTRACT DOCUMENTS   |   Page ',
                      italics: true,
                      size: 16,
                      font: 'Times New Roman',
                    }),
                    new TextRun({ children: [PageNumber.CURRENT], italics: true, size: 16, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 240 },
              children: [
                new TextRun({ text: `${row.csi_section} — ${row.csi_title.toUpperCase()}`, bold: true, size: 30, font: 'Times New Roman' }),
              ],
            }),
            ...buildPartParagraphs('PART 1', part1),
            ...buildPartParagraphs('PART 2', part2),
            ...buildPartParagraphs('PART 3', part3),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${row.csi_section.replace(/\s+/g, '-')}-AFS-Spec.docx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('[Spec DOCX Error]', error);
    return NextResponse.json({ error: 'Could not generate DOCX.' }, { status: 500 });
  }
}
