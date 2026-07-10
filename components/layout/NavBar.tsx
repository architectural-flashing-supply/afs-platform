import Link from 'next/link';
import Image from 'next/image';

export default function NavBar() {
  return (
    <>
      <div className="fixed top-0 left-0 bottom-0 w-60 z-50 bg-afs-bg-dim border-r border-afs-chrome-dim flex flex-col">
        <div className="flex items-center justify-center px-4 py-6">
          <Link href="/">
            <Image
              src="/afs-logo.png"
              alt="AFS Architectural Flashing Supply"
              width={200}
              height={90}
              priority
              className="w-full h-auto object-contain"
            />
          </Link>
        </div>
        <div className="flex-1" />
        <div className="px-4 py-4 border-t border-afs-chrome-dim">
          <p className="font-label text-xs text-afs-chrome-dim tracking-widest uppercase text-center">
            Est. Texas
          </p>
        </div>
      </div>

      <header className="fixed top-0 left-60 right-0 z-40 h-16 bg-afs-bg-raised border-b border-afs-chrome-dim flex items-center px-8">
        <div className="hidden md:flex items-center gap-8 flex-1">
          <Link href="/products" className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors">
            Products
          </Link>
          <Link href="/quote" className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors">
            Request a Quote
          </Link>
          <Link href="/upload" className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors">
            Upload Drawing
          </Link>
          <Link href="/architects" className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high transition-colors">
            Architects
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/upload" className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-5 py-2.5 rounded transition-colors">
            Submit a Drawing
          </Link>
          <Link href="/login" className="hidden sm:block border border-afs-chrome-dim text-afs-chrome-mid hover:text-afs-chrome-high font-label text-sm px-4 py-2.5 rounded transition-colors">
            Sign In
          </Link>
        </div>
      </header>
    </>
  );
}