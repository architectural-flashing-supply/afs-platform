import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-afs-bg-raised border-t border-afs-chrome-dim mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

          {/* Brand -- text only, no logo mark (the header is the one place
              the logo renders; see NavBar.tsx). */}
          <div>
            <h2 className="font-label text-sm font-bold uppercase tracking-widest text-afs-chrome-high mb-3">
              AFS — Architectural Flashing Supply
            </h2>
            <p className="font-body text-sm text-afs-chrome-base leading-relaxed mb-4">
              Custom sheet metal fabrication for contractors and architects.
            </p>
            <p className="font-body text-sm text-afs-chrome-base leading-relaxed">
              209 Sure Cast Drive<br />Burnet, Texas 78611
            </p>
            <p className="font-data text-sm text-afs-chrome-base mt-2">
              <a href="tel:+15123724900" className="hover:text-afs-chrome-mid transition-colors">
                (512) 372-4900
              </a>
            </p>
            <p className="font-body text-sm text-afs-chrome-base mt-1 break-all">
              <a
                href="mailto:trica@architecturalflashingsupply.com"
                className="hover:text-afs-chrome-mid transition-colors"
              >
                trica@architecturalflashingsupply.com
              </a>
            </p>
          </div>

          {/* Products */}
          <div>
            <h3 className="font-label text-xs text-afs-chrome-mid uppercase tracking-widest mb-4">Products</h3>
            <ul className="space-y-2">
              {['Coping Caps','Base Flashing','Drip Edge','Gravel Stop','Custom Profiles'].map(item => (
                <li key={item}>
                  <Link href="/products" className="font-body text-sm text-afs-chrome-base hover:text-afs-chrome-mid transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-label text-xs text-afs-chrome-mid uppercase tracking-widest mb-4">Resources</h3>
            <ul className="space-y-2">
              {[
                { label: 'Upload a Drawing', href: '/upload' },
                { label: 'Request a Quote', href: '/quote' },
                { label: 'Architect Portal', href: '/architects' },
                { label: 'Track an Order', href: '/account/orders' },
                { label: 'FAQ', href: '/faq' },
              ].map(item => (
                <li key={item.label}>
                  <Link href={item.href} className="font-body text-sm text-afs-chrome-base hover:text-afs-chrome-mid transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-label text-xs text-afs-chrome-mid uppercase tracking-widest mb-4">Company</h3>
            <ul className="space-y-2">
              {[
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
                { label: 'Privacy Policy', href: '/legal/privacy' },
                { label: 'Terms of Sale', href: '/legal/terms' },
              ].map(item => (
                <li key={item.label}>
                  <Link href={item.href} className="font-body text-sm text-afs-chrome-base hover:text-afs-chrome-mid transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-afs-chrome-dim pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-afs-chrome-dim">
            © {new Date().getFullYear()} AFS Architectural Flashing Supply. All rights reserved.
          </p>
          <p className="font-label text-xs text-afs-chrome-dim tracking-widest uppercase">
            SMACNA Standards Compliant
          </p>
        </div>
      </div>
    </footer>
  );
}