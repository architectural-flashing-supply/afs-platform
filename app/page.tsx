export default function HomePage() {
  return (
    <main className="min-h-screen bg-afs-bg-base flex flex-col items-center justify-center px-6">
      <div className="metal-edge bg-afs-bg-raised border border-[#48526A] rounded p-12 max-w-2xl w-full text-center">
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-6">
          ARCHITECTURAL FLASHING SUPPLY
        </p>
        <h1 className="font-display text-8xl text-afs-chrome-high leading-none mb-6">
          AFS
        </h1>
        <p className="font-body text-afs-chrome-mid text-lg mb-10">
          Custom fabricated sheet metal flashing. Platform launching soon.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a href="/quote" className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-4 rounded text-sm tracking-wide transition-colors">
            Request a Quote
          </a>
          <a href="/upload" className="border border-[#48526A] text-afs-chrome-mid hover:bg-afs-bg-surface font-label font-semibold px-8 py-4 rounded text-sm tracking-wide transition-colors">
            Upload a Drawing
          </a>
        </div>
      </div>
    </main>
  );
}