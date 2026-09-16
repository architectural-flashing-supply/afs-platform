import Image from 'next/image';

// afs-logo-512.png is the mark alone (crimson "AFS" lettering on a chrome-
// bevel frame, no text baked in beyond that) -- afs-logo.png is a full
// lockup with "ARCHITECTURAL FLASHING SUPPLY" already flattened into the
// image, which can't be restyled or resized independently of the mark.
// Composing the mark image + live "AFS" text + live tagline text here
// instead means all three stay legible (and independently styleable) at
// the header's actual render size.
//
// This is the ONLY logo component in the codebase (audited: a single
// `<AfsLogo />` call site in NavBar.tsx, none in Footer.tsx, which is
// text-only branding by design -- see that file's own comment). Do not
// add a second logo component or a per-page inline reimplementation of
// this lockup; extend this one instead.
const MARK_SRC = '/afs-logo-512.png';

export default function AfsLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-row items-center space-x-3 ${className}`}>
      <Image src={MARK_SRC} alt="" width={76} height={76} className="object-contain" />
      <div className="flex flex-col justify-center leading-none">
        {/* White/chrome-high, not "dark text": every place this component
            renders (header, and previously footer) has a dark gunmetal
            background -- dark text would be illegible there. If a light-
            background placement is ever added, this needs its own
            light-mode text color, not a global swap. */}
        <span className="font-display text-4xl font-bold text-afs-chrome-high">AFS</span>
        {/* hidden below md: at 10px + tracking-[0.2em], this line's actual
            rendered width (a 30-character tagline) is far wider than it
            looks -- on a 375px mobile header it was pushing the hamburger
            button off-screen. Full lockup (mark + AFS + tagline) only
            past md; mobile keeps mark + AFS. */}
        <span className="hidden font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-afs-crimson md:block">
          Architectural Flashing Supply
        </span>
      </div>
    </div>
  );
}
