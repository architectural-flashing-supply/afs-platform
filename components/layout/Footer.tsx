import Link from 'next/link';
import AfsLogo from './AfsLogo';

export default function Footer() {
  return (
    <footer className="bg-afs-bg-raised border-t border-afs-chrome-dim mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

          {/* Brand -- the real logo mark, same asset the header renders
              (05c772e previously removed this in favor of text-only
              branding; reinstated per explicit instruction). */}
          <div>
            <AfsLogo className="h-auto w-[180px] mb-4" />
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
                // /order-status, not /account/orders: this is a PUBLIC footer,
                // and /account/orders requires a session, so an anonymous
                // visitor following this link landed on /login. The public
                // lookup verifies by order number + the order's own email
                // instead (EES-OVN.06 R4.4).
                { label: 'Track an Order', href: '/order-status' },
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