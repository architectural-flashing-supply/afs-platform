import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import EmptyState from '@/components/ui/EmptyState';
import CADLibraryBrowser from '@/components/architects/CADLibraryBrowser';
import type { CADFile, CADFileFormat } from '@/components/architects/CADFileCard';

export const metadata: Metadata = {
  title: 'Technical Drawing Library | AFS Architectural Flashing Supply',
  description: 'DWG, DXF, and Revit families for every AFS architectural flashing profile.',
};

interface ProfileOption {
  id: string;
  name: string;
}

interface CADFileRow {
  id: string;
  profile_id: string | null;
  format: CADFileFormat;
  filename: string;
  description: string | null;
  version: string | null;
  revit_version: string | null;
  file_size_bytes: number | null;
  download_count: number;
  product_profiles: { id: string; name: string } | null;
}

interface ProductMaterialRow {
  profile_id: string | null;
  materials: { name: string } | null;
}

export default async function CADLibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profilesRaw } = await supabase
    .from('product_profiles')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const profileOptions = (profilesRaw ?? []) as ProfileOption[];

  const { data: filesRaw } = await supabase
    .from('cad_library_files')
    .select(
      'id, profile_id, format, filename, description, version, revit_version, file_size_bytes, download_count, product_profiles(id, name)'
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  const fileRows = (filesRaw ?? []) as unknown as CADFileRow[];

  const { data: productsRaw } = await supabase
    .from('products')
    .select('profile_id, materials(name)')
    .eq('is_active', true);
  const productRows = (productsRaw ?? []) as unknown as ProductMaterialRow[];

  const materialsByProfile: Record<string, string[]> = {};
  for (const p of productRows) {
    if (!p.profile_id || !p.materials?.name) continue;
    const list = materialsByProfile[p.profile_id] ?? [];
    if (!list.includes(p.materials.name)) list.push(p.materials.name);
    materialsByProfile[p.profile_id] = list;
  }

  const files: CADFile[] = fileRows.map((f) => ({
    id: f.id,
    profileId: f.profile_id ?? '',
    profileName: f.product_profiles?.name ?? 'Uncategorized Profile',
    format: f.format,
    filename: f.filename,
    description: f.description,
    fileSizeBytes: f.file_size_bytes,
    version: f.version,
    revitVersion: f.revit_version,
    downloadCount: f.download_count,
  }));

  const hasRevitFiles = files.some((f) => f.format === 'rfa' || f.format === 'rvt');

  return (
    <ArchitectShell>
      <section className="metal-edge metal-edge-copper px-6 pt-16 pb-12 text-center border-b border-afs-border">
        <ArchitectEyebrow>Technical Drawing Library</ArchitectEyebrow>
        <h1 className="font-display text-6xl text-afs-chrome-high leading-none mb-4">CAD &amp; BIM LIBRARY</h1>
        <p className="font-body text-afs-chrome-mid text-base max-w-2xl mx-auto">
          DWG, DXF, and Revit families for every AFS profile — drop them straight into your drawings.
        </p>
      </section>

      <div className="max-w-[1280px] mx-auto px-6 py-12">
        {files.length === 0 ? (
          <EmptyState
            title="CAD library being populated"
            description="Files available soon. In the meantime, request specific details through a design consultation."
            actionLabel="Schedule a Consultation"
            actionHref="/architects/consultation"
            accent="copper"
          />
        ) : (
          <CADLibraryBrowser
            files={files}
            profileOptions={profileOptions}
            materialsByProfile={materialsByProfile}
            hasRevitFiles={hasRevitFiles}
            isAuthenticated={Boolean(user)}
          />
        )}

        <div className="mt-14 text-center border-t border-afs-border pt-10">
          <p className="font-body text-sm text-afs-chrome-mid mb-4">
            Don&apos;t see your profile? Request a detail.
          </p>
          <Link
            href="/architects/consultation"
            className="inline-block bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
          >
            Schedule a Consultation
          </Link>
        </div>
      </div>
    </ArchitectShell>
  );
}
