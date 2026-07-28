// AFS Technical Knowledge Base — authored by AFS based on industry
// standards and fabrication expertise
//
// A comprehensive reference set covering copper systems, metal panel
// systems, aluminum systems, steel systems, flashing principles, and
// inspection/coordination topics — written in AFS's own voice from its
// fabrication and field experience. This is original AFS guidance, not
// reproduced or attributed to any third-party publication.
import type { KnowledgeChunk } from './types';

export const webKnowledge: KnowledgeChunk[] = [
  // ─────────────────────────────────────────────────────────────────
  // COPPER SYSTEMS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'webkb-copper-flashing-types',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Copper',
    topic: 'Copper flashing types and applications',
    content:
      'AFS fabricates copper flashing in several distinct forms, each suited to a different building condition. Through-wall flashing is a continuous copper membrane built into a masonry cavity wall to catch and redirect water that penetrates the outer wythe back out through weep holes; because it is fully concealed, it is typically formed from lighter 16oz copper for economy. Step flashing is used where a sloped roof plane meets a vertical wall, with individual L-shaped pieces woven in with each course of roofing so that water is always shed onto the roof surface rather than behind the flashing. Base and counter flashing form the two-part assembly at roof-to-wall and roof-to-curb intersections — base flashing turns up from the roof plane, counter flashing laps down over it from above, and the two are never combined into a single piece because that would prevent the counter flashing from being reset independently during a future reroof. Valley flashing runs the length of a roof valley to carry concentrated water flow, and is generally the heaviest-gauge copper on a given roof because it sees the highest volume of moving water. Reglet-set flashing is let into a saw-cut masonry joint and secured with lead wedges or a mechanical reglet system for a fully weathertight, concealed termination. AFS selects gauge and joint detailing for each of these applications based on exposure, water volume, and expected service life, since a single "copper flashing" gauge specification does not fit every condition on a building.',
    keywords: [
      'copper flashing types',
      'through-wall flashing',
      'step flashing',
      'base flashing',
      'counter flashing',
      'valley flashing',
      'reglet flashing',
      'copper applications',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-gutters',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Copper',
    topic: 'Copper gutter systems — K-style, half-round, and box gutters',
    content:
      'AFS fabricates three principal copper gutter profiles. K-style gutters have a decorative, crown-molding-like front face and a flat back and bottom, giving them the highest water-carrying capacity per inch of height for a given footprint, which makes them the most common choice on standard residential and light-commercial eaves. Half-round gutters are a true semicircular trough, traditionally hung from cast or formed brackets rather than a nailed-on hanger strip, and are specified almost exclusively for their historic or classical architectural appearance rather than for capacity. Box gutters are the largest-capacity option, built as a rectangular or trapezoidal trough that is often integrated into the roof structure itself rather than hung on the fascia — common on commercial buildings and larger historic structures where a hung gutter cannot handle the roof area draining into it. All three profiles are formed from copper sheet on a brake to AFS\'s shop standards, with soldered end caps, outlets, and seams rather than sealant-dependent joints, since a soldered copper gutter joint is a permanent metallurgical bond rather than a maintenance item. Gutter size and outlet count are calculated from the roof area draining to each run, local rainfall intensity, and the gutter profile\'s actual carrying capacity — undersizing a gutter is one of the most common causes of overflow and fascia water damage on an otherwise well-built roof. Copper gutters are hung with copper or compatible bronze hangers only, spaced to support the gutter\'s full weight when running full of water plus expected ice load in colder climates.',
    keywords: [
      'copper gutters',
      'K-style gutter',
      'half-round gutter',
      'box gutter',
      'gutter capacity',
      'gutter outlets',
      'soldered gutter seams',
      'gutter hangers',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-soldering',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Copper',
    topic: 'Soldering copper flashing — solder, flux, and technique',
    content:
      'A properly soldered copper seam is a true metallurgical bond, not an adhesive joint, and is the standard AFS uses for any copper seam intended to be fully watertight — gutters, flat-lock roofing, and critical flashing laps. AFS solders with 50/50 or 60/40 tin-lead solder and rosin-based paste or liquid flux only; acid flux (used in plumbing and general sheet metal work on other materials) must never touch copper roofing or flashing, because acid flux residue left on the surface continues to corrode the copper long after the joint is made, eventually causing a soldered seam to fail from the inside out. Surfaces to be soldered are first cleaned bright with steel wool or a fine abrasive to remove the oxide layer and any oils, since solder will not properly wet and bond to an oxidized or contaminated surface. Flux is applied immediately before soldering to prevent the freshly cleaned copper from reoxidizing. A properly heated iron — sized to the joint, typically 8 to 12 pounds for standard flashing and gutter work — should draw solder into the seam by capillary action along the full length of the lap in one continuous pass rather than being dabbed on in spots, which produces a stronger, more consistent joint with less visible buildup. After soldering, all flux residue is cleaned from the finished seam with water and a neutralizing wash, since even rosin flux residue left on the surface can interfere with patina development and trap moisture against the joint.',
    keywords: [
      'soldering copper',
      'tin-lead solder',
      'rosin flux',
      'acid flux warning',
      'copper seam',
      'soldering iron',
      'flat lock soldering',
      'copper joint technique',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-coping-design',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Copper',
    topic: 'Copper coping cap design requirements',
    content:
      'A copper coping cap sits atop a parapet wall and is one of the highest-consequence details AFS fabricates, since a coping failure sends water directly into the wall assembly below rather than onto a roof surface designed to shed it. AFS details copper coping on a continuous concealed cleat system — a front cleat engaging a hemmed front leg, and a rear leg engaging either a second cleat or a fastened receiver under the cap — so that no fasteners are ever exposed on the finished face, which both protects the copper\'s appearance and eliminates a common leak point. The cap is sloped toward the roof side, typically a minimum of 1/4 inch per foot, so wind-driven rain sheds back onto the roof rather than staining the exterior wall face below. Because copper moves significantly with temperature, coping runs are broken into sections generally no longer than about 10 to 12 feet, joined either with a batten-cover expansion joint or a deliberately gapped lap joint with backer rod and sealant, rather than fabricated as one continuous rigid length that would buckle. Both edges of the coping leg are hemmed for stiffness and to conceal the cleat engagement cleanly. On high-wind-exposure or insurance-rated projects, AFS engineers the full assembly — cap, cleat, and fastening pattern together, not the copper gauge alone — since coping wind-uplift failures typically originate at an underbuilt cleat or fastening pattern rather than the metal itself.',
    keywords: [
      'copper coping',
      'coping cap design',
      'parapet coping',
      'continuous cleat',
      'coping slope',
      'coping expansion joint',
      'coping wind uplift',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-gravel-stop-fascia',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Copper',
    topic: 'Copper gravel stop and fascia details',
    content:
      'A copper gravel stop forms the finished perimeter edge of a low-slope roof, retaining ballast where present, terminating the membrane, and shedding water off the roof edge — while a copper fascia cover simply dresses the vertical edge of a roof or floor line without necessarily managing membrane termination. Both are perimeter details, which means both see the highest wind-uplift pressures on the roof, so AFS attaches them the same way it attaches coping: a continuous concealed cleat engaging a hemmed front edge, fastened back to a wood nailer sized to the roof insulation thickness and securely anchored to the structural deck, rather than face-fastened. On a gravel stop specifically, the roof membrane must be properly adhered and terminated under the metal\'s roof-side flange per the membrane system\'s own detail requirements — the copper edge is only as watertight as the membrane termination it covers. Long runs of either gravel stop or fascia are broken with lap or expansion joints roughly every 10 to 12 feet to accommodate copper\'s thermal movement; an unbroken rigid run is prone to buckling and oil-canning as it heats and cools across the day. Because these are edge conditions with no adjacent roof field to help resist uplift, AFS evaluates the complete cleat-and-fastening assembly against the project\'s design wind pressure rather than assuming a standard gauge and cleat spacing is automatically adequate on every building.',
    keywords: [
      'copper gravel stop',
      'copper fascia',
      'roof edge metal',
      'membrane termination',
      'perimeter wind uplift',
      'continuous cleat fascia',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-patina',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Copper',
    topic: 'Copper patina development and maintenance',
    content:
      'Freshly fabricated copper is a bright, pinkish-orange metal that immediately begins reacting with the atmosphere. Within roughly the first six to eighteen months of weathering it darkens to a brown or chocolate tone as a cuprite (copper oxide) layer forms; the well-known blue-green verdigris patina that develops after that is a basic copper sulfate or carbonate layer, and depending on climate, pollution levels, and exposure to direct rainfall, it can take anywhere from several years to a decade or more to fully and evenly develop. Verdigris is not corrosion in the damaging sense — it is a dense, adherent, self-limiting oxide layer that actually protects the copper beneath it, which is a major reason architectural copper reaches such long service lives. Patina development is uneven by nature: areas that see regular direct rainfall weather faster than sheltered soffit or underside areas, which can remain bright or brown far longer, and this unevenness is normal rather than a defect. Patina should never be artificially accelerated with acids or "instant patina" chemical treatments on architectural work without owner and designer sign-off, since chemically forced patinas often look visually different from natural weathering and can behave differently over time. Maintenance is minimal by design — copper should not be cleaned with abrasive pads or acidic cleaners that strip the developing patina, and any adjacent construction debris, mortar splash, or acidic runoff from other materials should be rinsed off promptly so it does not etch or stain the surface unevenly during the early weathering period.',
    keywords: [
      'copper patina',
      'verdigris',
      'copper weathering',
      'copper oxidation',
      'patina maintenance',
      'copper aging',
      'cuprite',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-galvanic-compatibility',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Copper',
    topic: 'Galvanic compatibility of copper with other metals',
    content:
      'Copper sits at the noble end of the galvanic series relative to nearly every other metal used in architectural sheet metal work, which means that whenever copper is in electrical contact with a less-noble metal in the presence of moisture, the other metal corrodes preferentially and often rapidly. Aluminum and galvanized or plain steel are the two metals AFS flags most often on mixed-material projects: direct contact between copper and aluminum, or copper fasteners driven into aluminum trim, will accelerate corrosion of the aluminum at the contact point, and the same is true in reverse for steel. This risk is not limited to direct contact — runoff carrying dissolved copper ions from an upstream copper roof, gutter, or flashing can drip or wash across downstream aluminum, painted steel, or even certain masonry and concrete finishes and cause staining or accelerated corrosion well away from the copper itself, so drainage paths need to be designed with this in mind, not just physical contact points. The practical response is isolation: only copper, brass, or stainless steel fasteners and cleats should ever touch copper sheet metal; where copper and a dissimilar metal must physically meet (a transition detail, a mixed-material roof edge), AFS separates them with a compatible isolation membrane, gasket, or coating rather than allowing direct contact; and where copper drains onto or near aluminum or steel below, the detail is designed to direct that runoff away from the incompatible material rather than across it. Stainless steel and lead-coated copper are both galvanically compatible with copper and are the standard substitution when a copper-adjacent component needs a different appearance or property.',
    keywords: [
      'galvanic corrosion',
      'copper compatibility',
      'dissimilar metals',
      'copper aluminum contact',
      'copper steel contact',
      'galvanic isolation',
      'copper runoff staining',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-lead-coated-copper',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Copper',
    topic: 'Lead-coated copper applications and benefits',
    content:
      'Lead-coated copper is standard copper sheet with a thin lead coating fused to both surfaces, and AFS specifies it in two situations where plain copper is not the right fit. The first is aesthetic: lead-coated copper weathers to a uniform, soft matte gray almost immediately and holds that appearance indefinitely, rather than cycling through copper\'s bright, brown, and eventually verdigris stages over years — designers who want a consistent gray metal roof or flashing appearance from day one, without waiting on or committing to copper\'s natural patina timeline, specify lead-coated copper for this reason. The second is environmental staining control: because the visible surface is lead rather than exposed copper, runoff from a lead-coated copper roof does not carry the dissolved copper ions that can stain adjacent limestone, marble, painted surfaces, or downstream aluminum and steel the way bare copper runoff can — a meaningful consideration on historic masonry buildings or wherever copper staining of an adjacent finish material would be unacceptable. Structurally and mechanically, lead-coated copper is fabricated, formed, soldered, and detailed exactly like plain copper — it uses the same gauges, the same solder and flux, the same cleat and seam practices, and carries the same thermal expansion characteristics as the base copper sheet — so switching to lead-coated copper on a project changes the finished appearance and staining behavior without changing any of the underlying fabrication or installation approach. Cost runs modestly higher than plain copper of the same gauge, reflecting the added coating process.',
    keywords: [
      'lead-coated copper',
      'lead coated copper benefits',
      'copper staining prevention',
      'gray patina',
      'historic masonry copper',
      'lead-coated copper fabrication',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-thermal-expansion',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Copper',
    topic: 'Thermal expansion provisions for copper',
    content:
      'Copper has a coefficient of linear thermal expansion of roughly 0.0000094 per degree Fahrenheit, meaning a 20-foot run can move on the order of 3/16 to 1/4 inch or more across a typical seasonal or day-to-night temperature swing, and dark-weathered copper absorbs enough solar heat to see surface temperatures well above ambient air temperature, which increases the effective swing the metal actually experiences. AFS designs every copper detail longer than roughly 8 to 10 feet with an explicit accommodation for this movement rather than fixing it rigidly at both ends. On flat-seam and standing-seam copper roofing, this means loose-lock or floating-clip seam details that let panels slide slightly as they expand and contract, instead of fully soldered seams running the full length of a long panel run. On gutters, coping, fascia, and gravel stop, it means breaking long runs into sections joined by either a formal expansion joint (a batten-cover or slip-cover detail that conceals a deliberate gap) or an overlapping lap joint with backer rod and sealant at a sized gap, spaced roughly every 10 to 12 feet depending on color, exposure, and expected temperature range at the site. Cleats and fasteners are slotted or spaced to allow slight movement rather than pinning the metal tightly at every point. The single most common cause of oil-canning, split seams, and buckled copper trim AFS sees in the field is a long run that was fixed rigidly at both ends with no expansion joint in between — when a copper detail fails prematurely, checking for this is almost always the first and most productive diagnostic step.',
    keywords: [
      'copper thermal expansion',
      'copper expansion joint',
      'copper movement',
      'loose lock seam',
      'copper oil canning',
      'copper coefficient of expansion',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-standing-seam',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Copper',
    topic: 'Copper standing seam roofing',
    content:
      'Standing seam is one of two traditional copper roofing profiles AFS fabricates, distinguished from flat-lock (flat-seam) copper roofing by its raised, vertical seams rather than a smooth soldered surface. Panels are formed with upturned edges along both long sides that interlock at the seam — either a single-lock or double-lock mechanical fold, formed by hand or with a seaming machine — and are held down by concealed cleats fastened to the deck rather than by fasteners driven through the panel face. Because copper standing seam relies on a mechanically locked, unsoldered seam rather than a soldered one, the seam itself has to accommodate copper\'s thermal movement without leaking, which is why the cleats are typically a floating design that lets the panel slide slightly along its length as it expands and contracts, with a fixed point established at one end of each run (commonly the ridge) to control the direction of movement. Underlayment beneath copper standing seam should be a slip sheet or rosin paper rather than an asphaltic self-adhered membrane in direct contact with the copper, since some asphaltic compounds can react with and stain the underside of copper over time. Panel widths are generally kept narrower than typical steel or aluminum standing seam — often in the 16 to 20 inch range — both to control cost on an expensive material and because narrower copper panels resist oil-canning better than wide ones. Seam height, cleat spacing, and panel width are all sized together against the roof slope, expected wind exposure, and the total length of each panel run.',
    keywords: [
      'copper standing seam',
      'copper roof panels',
      'double lock copper',
      'floating cleats',
      'copper roof underlayment',
      'copper panel width',
    ],
    source: 'afs-knowledge',
  },

  // ─────────────────────────────────────────────────────────────────
  // METAL PANEL SYSTEMS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'webkb-metal-wall-panels',
    category: '07 42 00 Wall Panels',
    subcategory: 'Metal Panel Systems',
    topic: 'Metal wall panel systems and attachment',
    content:
      'AFS fabricates architectural metal wall panels in several structural approaches, and the right one depends on the wall assembly behind it as much as the desired appearance. Exposed-fastener panels are the simplest and most economical, attached directly through the panel face into girts or framing with gasketed screws; they are fast to install but every fastener penetration is a potential leak point that must be maintained over the building\'s life. Concealed-fastener panels interlock at the panel edges — a male leg on one panel engages a female leg on the next — so all fasteners are hidden under the adjacent panel, giving a cleaner appearance and eliminating the long-term maintenance burden of exposed screws, at a moderate cost premium. Panels are attached to a wall system either directly to steel or wood girts spaced to the panel\'s structural span rating, or over a rainscreen assembly with a drainage and ventilation gap behind the panel, which is increasingly standard on new construction because it lets any moisture that gets past the panel joint drain and dry rather than sitting against the building wrap. Panel joints, whether reveal joints between flat panels or interlocking seams, must be detailed with the same thermal-movement and water-shedding logic as roofing — panels are never rigidly fixed across their whole field, and vertical joints are typically detailed to shed water down and out rather than relying on sealant alone as the only line of defense. Corner conditions, transitions to window and door openings, and base-of-wall terminations are where the majority of wall panel water intrusion problems originate, so AFS details these connections explicitly rather than leaving them to field improvisation.',
    keywords: [
      'metal wall panels',
      'exposed fastener panel',
      'concealed fastener panel',
      'rainscreen panel system',
      'panel attachment',
      'wall panel joints',
      'girts',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-standing-seam-design',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Metal Panel Systems',
    topic: 'Standing seam roof system design',
    content:
      'Designing a standing seam roof system starts with matching the seam type to the roof\'s slope and wind exposure. Mechanically double-locked seams — formed after installation with a seaming machine — provide the highest wind and water resistance and are the correct choice for low-slope applications, generally below a 3:12 pitch, or any high-exposure site. Single-lock seams suit steeper, lower-exposure roofs at a lower installed cost. Snap-lock panels, which interlock by hand pressure without a seaming machine, install fastest of the three but carry meaningfully lower wind uplift ratings and should be reserved for sloped, moderate-exposure conditions rather than specified by default. Panel width is a real design variable, not just an aesthetic choice: narrower panels, generally 12 to 18 inches, resist oil-canning far better on long runs than wide panels, since a wide flat pan has more unsupported area to visually telegraph minor waviness. Clip spacing is engineered from panel width, material gauge, and the project\'s wind and snow load calculations — typically in the 12 to 24 inch on-center range — and should never be assumed at a standard spacing without checking it against the specific panel and site conditions. Every standing seam system needs one fixed attachment point per panel run, usually at the ridge or another defined control point, with the remaining clips floating to let the panel move freely along its length; a system with no fixed point, or with two fixed points on the same run, will fight itself thermally and is a common cause of premature seam distress.',
    keywords: [
      'standing seam design',
      'double lock seam',
      'single lock seam',
      'snap lock panel',
      'clip spacing',
      'fixed clip',
      'floating clip',
      'panel width oil canning',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-metal-panel-thermal-movement',
    category: '07 41 00 Roof Panels',
    subcategory: 'Metal Panel Systems',
    topic: 'Metal panel thermal movement',
    content:
      'Every metal panel system AFS builds — roof or wall — has to move as it heats and cools, and panel systems are specifically engineered to allow that movement rather than resist it, which is the opposite instinct most people bring to a structural building material. A dark-colored metal panel can reach surface temperatures fifty degrees Fahrenheit or more above the surrounding air temperature in direct sun, so the effective temperature swing a panel experiences over a day-night or seasonal cycle is much larger than the ambient air temperature swing alone would suggest. Panel systems accommodate this in three coordinated ways: floating clips or slotted fastener holes that let the panel slide slightly at its attachment points rather than being pinned tight; one fixed point per panel run (rather than zero or multiple) that establishes a controlled direction for the panel to expand and contract away from; and expansion joints breaking very long runs into shorter, independently moving sections, typically every 30 to 40 feet on extended roof or wall runs. Panel end conditions — ridges, eaves, corners, and terminations at adjacent materials — are the details most likely to get this wrong, because it is tempting to rigidly anchor a panel at both its start and its end for a clean, tight-looking termination; doing so pins the panel at two points and forces all of its thermal movement to happen as buckling somewhere in the field of the panel instead, which is one of the most common and most avoidable causes of oil-canning and long-term panel distress AFS sees on projects it did not originally fabricate.',
    keywords: [
      'metal panel thermal movement',
      'panel expansion',
      'floating clip system',
      'fixed point panel',
      'panel oil canning',
      'panel expansion joint spacing',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-kynar-pvdf-coating',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Metal Panel Systems',
    topic: 'Kynar / PVDF coating specifications',
    content:
      'Kynar 500 is a brand name for a PVDF (polyvinylidene fluoride) resin used in the highest-performance factory coating systems AFS specifies for aluminum and steel panels and flashing. PVDF coatings are valued for exceptional long-term color retention and chalk resistance under UV exposure — a well-specified PVDF-coated panel can hold its color within acceptable tolerances for 20 to 30 years or more, well beyond what conventional polyester or acrylic coatings achieve over the same exposure period. The industry benchmark for this coating tier is AAMA 2605, which sets minimum performance thresholds for color retention, chalk resistance, gloss retention, and film integrity under accelerated and real-world weathering, and requires a minimum PVDF resin content in the coating formulation to qualify at that tier. AFS distinguishes AAMA 2605-tier coatings from the lower AAMA 2604 tier, which uses a lower-resin-content PVDF or a different resin chemistry and is rated for a shorter service life and lower fade resistance — both are legitimate coating choices, but they are not interchangeable on a project where 20-plus-year color performance was specified, and substituting one for the other without owner and designer awareness can create a real performance gap that only shows up years after installation. Coating is applied to coil stock before fabrication (coil coating) rather than after forming, which produces a more uniform, better-adhered finish than post-formed spray coatings, but does mean tight bend radii and field-cut edges expose unpainted substrate that needs to be addressed with a compatible touch-up system.',
    keywords: [
      'Kynar 500',
      'PVDF coating',
      'AAMA 2605',
      'AAMA 2604',
      'color retention coating',
      'coil coating',
      'fluoropolymer finish',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-metal-roof-drainage',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Metal Panel Systems',
    topic: 'Metal roof drainage design',
    content:
      'Drainage is a whole-roof design problem, not just a gutter-sizing exercise, and AFS starts from the roof area draining to each collection point rather than from a standard gutter or downspout size. Total roof area, local rainfall intensity for the design storm, and the specific carrying capacity of the chosen gutter profile together determine the minimum gutter cross-section and the number and size of outlets needed — undersizing any one of these is one of the most common causes of overflow, fascia staining, and water intrusion at the eave on an otherwise well-built metal roof. Valleys concentrate water flow from two roof planes into a single channel and need to be sized and detailed as the highest-volume drainage path on the roof, generally in the heaviest gauge material used anywhere on that roof. Cross-slope and low-slope metal roof areas need positive drainage designed into the panel layout and any structural roof slope beneath the panels — metal roofing is not a ponding-tolerant material, and standing water accelerates seam and fastener degradation regardless of the metal type. Downspouts must be sized and located to actually handle the flow their connected gutter run delivers, with overflow provisions (scuppers or secondary drains) at any roof area where a clogged primary drainage path could otherwise back water up into the building. On re-roofing and renovation projects, AFS re-verifies existing drainage sizing against current roof area and any changes to the roof plan rather than assuming the original drainage design was correct or still adequate for how the building is used today.',
    keywords: [
      'metal roof drainage',
      'gutter sizing',
      'valley flashing capacity',
      'downspout sizing',
      'roof overflow',
      'positive drainage',
      'ponding water',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-wind-uplift-metal-roofing',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Metal Panel Systems',
    topic: 'Wind uplift considerations for metal roofing',
    content:
      'Wind creates a suction (uplift) force on a roof surface rather than pushing straight down on it, and that force is not uniform across the roof — perimeter and corner zones see substantially higher uplift pressures than the field of the roof under the same wind event, per standard wind-load design provisions. This is why AFS tightens fastener and clip spacing at eaves, ridges, rakes, and corners relative to the field spacing used across the main roof area, rather than applying one uniform attachment pattern everywhere. Edge metal details — coping, gravel stop, and fascia — sit in the highest-pressure zones on the entire roof and are evaluated as complete assemblies: cleat gauge, cleat spacing, fastener type and spacing, and nailer attachment together, since wind-uplift failures at roof edges typically start at an underbuilt cleat or fastening pattern rather than a failure of the metal panel itself. On projects governed by insurance wind-uplift requirements or built in high-wind coastal or hurricane-exposed regions, AFS specifies and, where required, tests edge metal and roof accessory assemblies to recognized wind-uplift rating standards for the project\'s design wind pressure, rather than relying on a standard detail that may have been adequate in a lower-wind region. Standing seam clip type and spacing are likewise selected against the same wind pressure calculation used for the edge metal — a snap-lock panel system that is entirely appropriate on a sheltered, low-wind-exposure roof may not carry an adequate rating for a high-exposure or coastal application, and substituting seam types without re-checking the uplift rating is a common and avoidable design gap.',
    keywords: [
      'wind uplift metal roof',
      'roof perimeter zones',
      'roof corner zones',
      'edge metal wind rating',
      'ANSI SPRI ES-1',
      'FM 4435',
      'wind uplift testing',
    ],
    source: 'afs-knowledge',
  },

  // ─────────────────────────────────────────────────────────────────
  // ALUMINUM SYSTEMS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'webkb-aluminum-alloy-selection',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Aluminum',
    topic: 'Aluminum alloy selection for architectural use (3003-H14)',
    content:
      'AFS fabricates the large majority of its architectural aluminum flashing, coping, panels, and trim from 3003-H14 alloy, and that choice is deliberate rather than default. The 3003 series is an aluminum-manganese alloy chosen specifically for formability — it bends cleanly on a brake through the tight radii architectural sheet metal work requires without cracking at the bend line, which is the failure mode that rules out several higher-strength aluminum alloys for this kind of fabrication. The H14 temper designation indicates a strain-hardened (cold-worked), partially annealed condition that gives 3003 a useful middle ground of stiffness and formability — stiffer and more dent-resistant than a fully annealed O-temper sheet, but still forms without the cracking risk of a fully hardened temper. For applications needing more rigidity — larger unsupported panel spans, or details prone to oil-canning at standard gauge — AFS increases gauge (moving from .032" toward .040", .050", or .063") rather than switching to a harder, less formable alloy, since gauge is the more predictable and more field-proven way to add stiffness to architectural aluminum work. Higher-strength alloys such as 5052 do see occasional structural or higher-load applications outside standard flashing and trim work, but they are the exception on AFS\'s typical scope, not the rule; 3003-H14 remains the default starting point for essentially every aluminum flashing, coping, and trim detail AFS fabricates unless a specific project condition calls for something else.',
    keywords: [
      'aluminum alloy',
      '3003-H14',
      'aluminum temper',
      'aluminum formability',
      'aluminum gauge selection',
      'architectural aluminum alloy',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-aluminum-finishes',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Aluminum',
    topic: 'Aluminum finish specifications — mill, anodized, and painted',
    content:
      'AFS fabricates aluminum in three broad finish categories, each with a different appearance and a different set of handling and compatibility considerations. Mill finish is bare, unfinished aluminum straight from the coil — the lowest-cost option, with the natural gray-silver appearance and modest oxide layer aluminum develops on its own, generally reserved for concealed work or applications where painted or anodized appearance is not required. Anodized finish is an electrochemically grown oxide layer that becomes part of the metal surface itself rather than a coating applied on top of it, which means it cannot peel, chip, or delaminate the way a paint film can — anodizing is available in clear (natural silver) and a range of integral colors, and is prized for durability in high-touch or high-abrasion applications, though its color range is narrower than painted finishes and color-matching anodized aluminum to a painted material elsewhere on the same building takes careful coordination. Painted finish is the most common choice for color-matched architectural work, applied as a coil coating before fabrication in polyester, PVDF/Kynar, or other resin systems depending on the required service life and color-retention performance — AFS matches the paint system to the project\'s specified performance tier rather than defaulting to the least expensive coating available. Whichever finish is specified, field-cut edges and tight bend radii expose unfinished substrate at that specific location, which needs a touch-up or edge-sealing approach appropriate to that finish type to avoid a visually inconsistent or under-protected edge condition over the life of the installation.',
    keywords: [
      'aluminum finishes',
      'mill finish aluminum',
      'anodized aluminum',
      'painted aluminum',
      'coil coating aluminum',
      'aluminum color match',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-aama-2605',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Aluminum',
    topic: 'AAMA 2605 coating specification requirements',
    content:
      'AAMA 2605 is the top-tier performance designation AFS specifies for factory-applied organic coatings on aluminum, and it sets thresholds — not just resin type — that a coating system has to meet: minimum color change, chalk resistance, gloss retention, and film integrity after extended accelerated weathering exposure and after long-term real-world South Florida exposure testing, which is the industry\'s standard severe-exposure benchmark. Meeting AAMA 2605 generally requires a coating formulated with a high minimum PVDF (Kynar-type) resin content, since lower-resin-content or non-fluoropolymer coatings cannot reliably hold the required color and gloss retention thresholds over the rated exposure period. AFS treats AAMA 2605 as materially different from the lower AAMA 2604 tier — 2604 permits a lower resin content or different chemistry and is tested and rated to a less demanding, shorter-duration performance standard — and flags the distinction explicitly on any project where long-term color consistency across a building facade or roof matters, since the two coating tiers are not interchangeable even though they can look identical on the day they are installed. Because coating performance is tested at the system level, not just judged by resin percentage on a data sheet, AFS sources coated coil stock from suppliers who can provide actual AAMA 2605 test data and warranty documentation for the specific coating and color being used, rather than accepting an unsubstantiated "meets AAMA 2605" claim, since color and finish warranties on architectural projects are frequently tied to this exact designation.',
    keywords: [
      'AAMA 2605',
      'AAMA 2604',
      'coating performance standard',
      'PVDF resin content',
      'coating warranty',
      'color retention specification',
      'South Florida exposure testing',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-aluminum-thermal-expansion',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Aluminum',
    topic: 'Aluminum thermal expansion characteristics',
    content:
      'Aluminum has a notably higher coefficient of thermal expansion than copper, galvanized steel, or stainless steel — roughly double copper\'s rate — which translates to about 3/16 inch of movement per 10 linear feet across a typical seasonal or day-to-night temperature swing, more on darker-colored panels that run hotter in direct sun. AFS accounts for this at the detailing stage rather than treating aluminum expansion joint spacing the same as it would for a lower-movement metal: expansion joints on long aluminum coping, fascia, and panel runs are generally spaced tighter than the equivalent detail would need in copper or steel, cleat and clip engagement is designed with more generous slotted tolerance to let the panel or trim piece slide as it moves, and fastener holes at attachment points are elongated rather than drilled tight to the fastener shank. Aluminum standing seam and wall panel systems rely on the same floating-clip logic used on other metals, but the clip travel and slot length are sized specifically to aluminum\'s greater movement rather than reused from a steel or copper panel design. Getting this wrong is a common and avoidable failure mode: a long aluminum coping or fascia run detailed with copper-appropriate (tighter) expansion joint spacing will typically show oil-canning, buckling, or seam distress well before an equivalent copper installation would, simply because the metal is moving more than the detail was designed to absorb.',
    keywords: [
      'aluminum thermal expansion',
      'aluminum coefficient of expansion',
      'aluminum expansion joint spacing',
      'aluminum movement',
      'aluminum oil canning',
      'slotted fastener aluminum',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-aluminum-compatibility',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Aluminum',
    topic: 'Aluminum compatibility with other materials',
    content:
      'Aluminum sits close to the active end of the galvanic series, which makes it the most compatibility-sensitive common architectural metal AFS works with — it corrodes preferentially when in contact with copper or, to a lesser but still real degree, with stainless steel and plain (uncoated) steel, in the presence of moisture. Copper contact is the risk AFS flags most often: direct contact between aluminum and copper, copper fasteners driven into aluminum, or even copper-bearing runoff draining across aluminum from an upstream copper roof, gutter, or flashing detail will accelerate localized aluminum corrosion, sometimes severely, at the contact or runoff point. Aluminum is also sensitive to direct contact with certain masonry materials — fresh concrete, mortar, and some masonry cleaning or efflorescence-treatment chemicals are alkaline enough to attack unprotected aluminum — so aluminum flashing or trim embedded in or contacting fresh masonry is typically isolated with a bituminous coating or compatible isolation membrane rather than installed bare against the masonry surface. The practical response mirrors copper\'s own compatibility rules: aluminum, stainless steel, or specifically coated fasteners for attachment; isolation membranes, gaskets, or coatings at any point where aluminum must physically meet copper, uncoated steel, or fresh masonry; and drainage details designed so that runoff from a copper or steel component upstream is directed away from aluminum surfaces below rather than across them. Aluminum is fully compatible with Galvalume, painted (coated) steel, and most factory-applied coatings, so mixed-material assemblies using those combinations do not require the same isolation measures.',
    keywords: [
      'aluminum compatibility',
      'aluminum galvanic corrosion',
      'aluminum copper contact',
      'aluminum masonry contact',
      'isolation membrane aluminum',
      'aluminum fastener compatibility',
    ],
    source: 'afs-knowledge',
  },

  // ─────────────────────────────────────────────────────────────────
  // STEEL SYSTEMS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'webkb-galvanized-steel-specs',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Steel',
    topic: 'Galvanized steel roofing and flashing specifications',
    content:
      'Galvanized steel used in AFS\'s architectural work is specified in standard sheet gauge numbers — 24ga, 22ga, and 20ga cover the common architectural range, with lower gauge numbers indicating thicker, stiffer material, generally reserved for larger panels or higher-load applications. Coating can be applied one of two ways: hot-dip galvanizing, where fabricated or coil steel is dipped in molten zinc to produce a thicker, more corrosion-resistant coating, typically used for the heaviest-duty exterior exposure and for pieces galvanized after fabrication; and electrogalvanizing, an electroplated zinc coating that is thinner and more uniform in appearance, more commonly applied to coil stock before it is formed. AFS uses galvanized steel most often for concealed or largely-concealed structural sheet metal — cleats, Z-bar and pitch-change trim, blocking straps, and other backup components — where cost matters more than final finish appearance, as well as for exposed roofing and flashing on projects where a painted finish is not required or where the project budget calls for galvanized steel rather than a higher-cost material. Any weld, drilled hole, or field-cut edge on galvanized steel breaks the protective zinc coating locally and exposes bare steel at that point; AFS applies a zinc-rich touch-up coating to every such location during fabrication and instructs field crews to do the same for any field cuts, since an unaddressed cut or weld will rust preferentially at that spot even though the surrounding coated sheet remains fully protected.',
    keywords: [
      'galvanized steel',
      'hot-dip galvanizing',
      'electrogalvanizing',
      'galvanized steel gauge',
      'zinc coating touch-up',
      'galvanized cleats',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-g90-coating',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Steel',
    topic: 'G-90 coating requirements',
    content:
      'G-90 is the zinc coating weight designation AFS treats as the practical minimum for galvanized steel used in exterior architectural applications — it specifies a minimum of 0.90 ounces of zinc coating per square foot of sheet, measured on a total-both-sides basis per the standard test method for coating weight. Lighter coating designations such as G-60 or G-40 carry proportionally less zinc and correspondingly less corrosion protection, and while they are acceptable for interior, concealed, or less-exposed applications where cost is the driving factor, AFS does not use them for exposed exterior roofing, flashing, or trim, since they will visibly rust through significantly faster than G-90 material in the same environment. On more aggressive exposures — coastal, industrial, or high-humidity environments — AFS often steps up from standard G-90 galvanized steel to Galvalume (an aluminum-zinc alloy coating) rather than a heavier straight-zinc coating designation, since Galvalume generally outperforms even heavier zinc-only coatings in those specific environments while remaining fully compatible with standard paint systems. Coating weight is a bulk material property, not something that survives a cut edge or a weld: as with any galvanized product, every field cut, drilled hole, and weld location breaks through the coating at that spot and needs a zinc-rich touch-up compound applied before the piece is put into service, regardless of whether the base material was G-90 or a heavier designation.',
    keywords: [
      'G-90 coating',
      'zinc coating weight',
      'G-60 galvanized',
      'galvanized coastal exposure',
      'coating weight designation',
      'Galvalume alternative',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-steel-panel-profiles',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Steel',
    topic: 'Steel panel profiles and applications',
    content:
      'AFS fabricates and specifies steel roofing and wall panels in several distinct profile families, chosen for the building type and performance requirement rather than appearance alone. Standing seam profiles in steel follow the same double-lock, single-lock, and snap-lock seam logic used across other metals, and are the standard choice where a concealed-fastener, high-wind-performance roof is required — steel\'s comparatively low thermal movement relative to aluminum or copper makes it a forgiving material for long standing seam runs. Corrugated and ribbed exposed-fastener panels are a lower-cost, faster-installing alternative common on agricultural, industrial, and utilitarian commercial buildings, trading the concealed-fastener system\'s cleaner appearance and lower long-term maintenance for significantly lower installed cost. R-panel and similar trapezoidal-rib profiles sit between those two in both cost and appearance, and are widely used on pre-engineered metal building construction where the panel also serves as the primary weather barrier over open framing rather than over a solid deck. Flat and reveal-joint panel systems, generally in heavier-gauge steel, are used on higher-end architectural facades where a smooth, minimal-seam appearance is the design intent, at a material and labor cost premium over ribbed profiles. Regardless of profile, steel panel gauge and clip or fastener spacing are engineered against the specific span, wind load, and (for roofing) slope and drainage requirements of the project — a profile and gauge that performs well on a low-rise agricultural building is not automatically adequate for a high-wind-exposure commercial roof, and AFS sizes each project\'s panel system independently rather than reusing a standard specification across unrelated building types.',
    keywords: [
      'steel panel profiles',
      'corrugated steel panel',
      'R-panel',
      'standing seam steel',
      'exposed fastener panel steel',
      'pre-engineered metal building panels',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-steel-paint-systems',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Steel',
    topic: 'Paint systems for steel flashing',
    content:
      'Painted steel used in AFS\'s flashing, trim, and panel work is almost always coil-coated — the paint system is applied to the flat steel coil before fabrication, under controlled factory conditions, rather than sprayed on after forming, which produces a more uniform, better-adhered finish than a field- or shop-applied post-formed coating can achieve. AFS specifies coating systems in the same performance tiers used across other painted metals: polyester coatings for standard-duration architectural work at a lower cost, and PVDF/Kynar-type fluoropolymer coatings meeting AAMA 2605 where 20-plus-year color and gloss retention is required, with the intermediate AAMA 2604 tier available where a step up from standard polyester is wanted without the full cost of a top-tier PVDF system. Regardless of coating tier, the coating\'s performance depends on an intact, corrosion-resistant substrate underneath it — AFS specifies painted finishes over a galvanized or Galvalume base coat on steel, never bare cold-rolled steel, since a paint film alone does not protect steel from rusting once any pinhole, scratch, or edge exposes the bare metal beneath it. As with any coil-coated material, field cuts, drilled holes, and bend-radius stress points expose unpainted or thinned coating at that specific location and need a compatible touch-up paint system to maintain both corrosion protection and finish appearance; AFS supplies touch-up paint matched to the specified coating and color with every painted steel order for exactly this reason.',
    keywords: [
      'painted steel',
      'coil-coated steel',
      'polyester coating steel',
      'PVDF steel coating',
      'galvanized substrate paint',
      'touch-up paint steel',
    ],
    source: 'afs-knowledge',
  },

  // ─────────────────────────────────────────────────────────────────
  // FLASHING PRINCIPLES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'webkb-roof-flashing-principles',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Flashing Principles',
    topic: 'Roof flashing principles and best practices',
    content:
      'Every flashing detail AFS fabricates follows the same underlying logic regardless of material or location: water must always be directed downward and outward, shed from one surface onto the one below it in a continuous overlapping sequence, never allowed to pool or be driven backward by wind or capillary action into a joint. This "shingle-style" lapping — each higher piece overlapping the one below it, in the direction water actually flows off the roof — is the single most important principle in flashing design, and the majority of flashing failures AFS is called to diagnose trace back to a lap installed backward or a transition where this sequence was broken. Two-part assemblies, such as base and counter flashing, exist specifically so that the piece exposed to the most weathering and thermal movement (counter flashing) can be replaced or reset without disturbing the roof membrane seal underneath it — combining the two into a single rigid piece may look simpler on the drawing but removes that maintainability and increases long-term risk. Flashing laps need a minimum engagement — commonly at least 4 inches on standard laps, more on high-exposure or low-slope conditions — and every flashing detail needs an explicit thermal-movement accommodation on runs longer than roughly 8 to 12 feet, since a technically correct lap sequence will still fail if the metal is rigidly pinned and forced to buckle. Flashing should never be relied on as a standalone waterproofing layer at a genuinely wet condition (below grade, or a plaza deck, for example) — it is a shedding and diversion system that works in combination with, not instead of, the roof or wall membrane it is detailed against.',
    keywords: [
      'flashing principles',
      'shingle-style lapping',
      'flashing lap minimum',
      'two-part flashing assembly',
      'flashing best practices',
      'flashing sequence',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-metal-edge-systems',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Flashing Principles',
    topic: 'Metal edge system requirements',
    content:
      'Roof edge metal — coping, gravel stop, and fascia — is the perimeter condition where wind uplift pressures are consistently highest on any building, which is why AFS evaluates and details edge metal as a complete assembly rather than by metal gauge alone. A correctly built edge metal system has four coordinated components: a continuous concealed cleat (front, and often rear) that lets the metal be hemmed and hung without exposed face fasteners; a wood nailer sized to match the roof insulation thickness and securely anchored to the structural deck, since the entire system\'s wind resistance is only as good as the nailer\'s attachment to the structure; a fastening pattern for both the cleat and the nailer that is engineered to the project\'s specific design wind pressure, tightened at corners and high-exposure zones relative to typical runs; and a joint system — lap joints or formal expansion joints, spaced roughly every 10 to 12 feet — that lets the metal move thermally without buckling. On any project governed by insurance wind-uplift requirements or built in a high-wind or coastal region, AFS specifies and, where required, tests the complete edge metal assembly against recognized wind-uplift standards for the project\'s actual design pressure, since real-world edge metal failures trace back to an underbuilt cleat or fastening pattern far more often than to a failure of the sheet metal itself. Edge metal also has to properly terminate and interface with the roof membrane or roofing material beneath it — the metal is only as watertight as the roof system\'s termination detail it covers, so edge metal design is never purely a sheet-metal-in-isolation exercise.',
    keywords: [
      'metal edge system',
      'roof edge metal',
      'coping cleat system',
      'gravel stop assembly',
      'edge metal wind rating',
      'roof nailer attachment',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-low-slope-drainage-design',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Flashing Principles',
    topic: 'Drainage design for low-slope roofs',
    content:
      'Low-slope roofs have far less margin for drainage error than steep-slope roofs, since gravity alone provides much less help moving water toward drains and any low spot or undersized drainage point becomes a standing-water condition rather than a minor inconvenience. AFS approaches low-slope drainage design starting from the structural roof slope itself — positive slope to drains, generally a minimum of 1/4 inch per foot where the structure allows it, is always preferable to relying on tapered insulation alone to create fall on an otherwise flat deck, though tapered insulation systems are a standard and effective solution where structural slope is not achievable. Every low-slope roof needs both a primary drainage path (interior drains, scuppers, or a perimeter gutter system) sized to the roof area and design rainfall intensity, and a secondary or overflow drainage path — additional overflow scuppers or secondary roof drains set slightly higher than the primary drains — so that a clogged or overwhelmed primary system cannot silently back water up against the roof edge or, worse, into the building. Roof edge and parapet details on low-slope roofs (coping, gravel stop) need to be evaluated for how they behave if water does pond briefly against them during a design storm, not just under normal light-rain conditions. AFS re-checks drainage sizing on every re-roofing or roof-area-changing renovation project rather than assuming the original drainage design remains adequate, since additions, rooftop equipment changes, or a change in roofing material can all change the effective drainage demand on existing drains and gutters.',
    keywords: [
      'low-slope drainage',
      'roof drains',
      'overflow scuppers',
      'tapered insulation',
      'positive roof slope',
      'secondary drainage',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-penetration-curb-flashing',
    category: '07 72 00 Roof Accessories',
    subcategory: 'Flashing Principles',
    topic: 'Flashing at penetrations and equipment curbs',
    content:
      'Roof penetrations — pipes, conduits, and especially rooftop equipment curbs for HVAC units, exhaust fans, and skylights — are consistently among the highest-risk leak locations on any roof, because each one interrupts the continuous roof membrane and has to be flashed individually rather than relying on the field roofing system. AFS\'s standard approach to equipment curbs follows the same shingle-lap logic as any other flashing: the curb should sit above the finished roof surface by a minimum clearance (commonly at least 8 inches on low-slope roofs, more in heavy-snow regions) so the equipment and its flashing are never in direct contact with standing or wind-driven water at the roof surface; the roof membrane or roofing material is flashed up and over the curb base, and a separate counter-flashing or cap flashing at the equipment itself laps down over that base flashing, preserving the same removable two-part logic used at wall intersections. Round penetrations (pipes, conduits) use a formed or manufactured boot or flashing collar sized to the penetration diameter, sealed at the pipe with a compatible, UV-stable sealant or mechanical clamp rather than sealant alone wherever possible, since sealant-only pipe flashings are one of the more common re-leak points AFS sees on service calls. Curb and penetration flashing details need to be coordinated before the equipment is set, not improvised afterward — a curb built and set before the roofing and flashing trade is engaged frequently ends up undersized in height or poorly positioned relative to roof drainage, forcing a compromised flashing detail around a fixed obstruction instead of a properly integrated one.',
    keywords: [
      'penetration flashing',
      'equipment curb flashing',
      'rooftop unit curb',
      'curb height clearance',
      'pipe boot flashing',
      'skylight flashing',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-reroofing-flashing-replacement',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Flashing Principles',
    topic: 'Re-roofing and flashing replacement considerations',
    content:
      'Re-roofing is rarely just a membrane or shingle replacement — the flashing details are usually where a re-roof project either succeeds or quietly sets up its next failure. AFS treats existing edge metal, coping, counter flashing, and penetration flashing as suspect by default on any re-roof scope rather than assuming components that are being reused are still sound, since flashing frequently outlives its originally intended service life in appearance while its underlying attachment, sealant joints, or concealed fasteners have already failed. Counter flashing is the component most commonly reused incorrectly: because it is designed to be removable and reset independently of the roof membrane, it is tempting to simply lift and reinstall existing counter flashing over new roofing, but AFS inspects it first for corrosion, distorted reglets, or damaged hem edges before deciding to reuse rather than replace it. Drainage capacity should be re-verified against the new roofing system and the roof\'s current condition, not assumed unchanged from the original design — added rooftop equipment, building additions, or even a change in roofing material\'s surface characteristics can shift effective drainage demand. Nailers under edge metal are frequently found deteriorated or inadequately anchored to the structural deck on older buildings, and a re-roof that reuses roofing membrane-fastening logic without inspecting the nailer underneath the edge metal is a common, avoidable setup for a wind-uplift failure shortly after project completion. AFS also treats a re-roof as an opportunity to correct any legacy detailing that does not meet current expansion-joint, drainage, or wind-uplift practice, rather than exactly reproducing an original detail that may have been the actual cause of the roof\'s prior failure.',
    keywords: [
      're-roofing',
      'flashing replacement',
      'counter flashing reuse',
      'nailer inspection',
      're-roof drainage verification',
      'legacy flashing detail',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-flashing-sealant-practices',
    category: '07 92 00 Joint Sealants',
    subcategory: 'Flashing Principles',
    topic: 'Sealant and backer rod practices in sheet metal flashing',
    content:
      'AFS treats sealant as a secondary line of defense in flashing work, not the primary waterproofing mechanism — a well-detailed flashing lap sheds water through geometry and gravity first, with sealant filling and protecting the joint rather than being the only thing holding water out. Where a sealed joint is genuinely load-bearing for weathertightness — an expansion joint gap, a sealant-and-backer-rod lap on a long coping or fascia run, or a termination against an adjacent material — AFS sizes the joint width specifically for the sealant being used, since every sealant chemistry has a rated movement capability (the percentage of joint width it can stretch and compress without losing adhesion or tearing) and an undersized or oversized joint relative to that rating is a common, avoidable cause of premature sealant failure. Backer rod is set at the correct depth behind the sealant bead to create the right sealant profile (generally a roughly 2:1 or 1:1 width-to-depth ratio depending on the sealant) and to prevent three-sided adhesion, where sealant bonds to the bottom of the joint as well as both sides, which restricts the joint\'s ability to move and tears the sealant apart at far lower movement than a properly two-sided bond would withstand. Sealant selection has to match the metals it will contact — some sealant chemistries are incompatible with certain metal coatings or can stain lighter-colored painted or anodized finishes — and joints intended for future resealing (rather than a fully welded or soldered seam) need to remain accessible for maintenance, which AFS accounts for in the detail rather than burying a sealed joint where it cannot realistically be inspected or redone.',
    keywords: [
      'sealant practices flashing',
      'backer rod',
      'joint movement capability',
      'three-sided adhesion',
      'sealant sizing',
      'expansion joint sealant',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-scupper-overflow-design',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Flashing Principles',
    topic: 'Scupper and overflow drain design',
    content:
      'A scupper is a through-wall opening, typically fitted with a formed metal sleeve or box, that lets water drain off a low-slope roof through the parapet wall rather than down through an interior roof drain — and AFS designs every scupper as part of a two-scupper (or drain-plus-overflow) system rather than a single opening whenever the roof design allows it. Primary scuppers are set at the roof\'s design drainage elevation and sized, together with any connected downspout or conductor head, to the actual roof area and design rainfall intensity draining to that point. Overflow scuppers are set two to four inches higher than the primary scupper (or primary roof drain) specifically so that if the primary path clogs with debris or is simply overwhelmed in an extreme storm, water has a visible, deliberate second path off the roof before it can pond high enough to threaten the roof edge, coping, or, in the worst case, the structural capacity of the roof itself under ponded weight. The scupper sleeve or box is flashed into the parapet and roof membrane using the same shingle-lap, two-part-assembly logic as any other roof-to-wall flashing, with a formed metal exterior face or conductor head directing the discharge cleanly away from the building face below rather than washing it down the exterior wall. Scupper location matters as much as sizing — a scupper placed at a genuine low point in the roof\'s drainage plan performs completely differently than one placed for a convenient elevation or appearance, so AFS coordinates scupper placement directly against the roof\'s actual drainage design rather than after the fact.',
    keywords: [
      'scupper design',
      'overflow scupper',
      'through-wall drainage',
      'conductor head',
      'roof ponding',
      'scupper flashing',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-reglets-through-wall',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Flashing Principles',
    topic: 'Reglets and through-wall flashing termination',
    content:
      'A reglet is a slot — either cut into existing masonry, cast into new concrete, or provided as a surface-mounted or masonry-set metal receiver — that gives counter flashing or through-wall flashing a positive, mechanically secured termination into the wall above the base flashing it protects. AFS distinguishes three reglet approaches by project condition: cut-in reglets, saw-cut into existing masonry joints on renovation and re-roofing work, into which the flashing leg is inserted and secured with lead wedges or a proprietary caulk-in anchor and then sealed; cast-in reglets, formed into new concrete or masonry during original construction, which give the cleanest, most reliable termination but have to be coordinated with the structural and masonry trades well before the wall is built; and surface-mounted reglets, a formed metal receiver fastened to the face of an existing wall where cutting into the masonry is not practical or desirable, sealed at the top with sealant rather than relying on the mechanical wedge-and-slot engagement of a true cut-in reglet. Through-wall flashing set at a reglet needs the same shingle-lap orientation as any other flashing — the flashing leg must be seated so that any water reaching the reglet drains down and out along the flashing rather than pooling in the slot. Reglet location is a coordination point that AFS raises early on any project involving masonry: setting a reglet too low or too high relative to the actual roof or base flashing height it needs to serve is a common, costly error to fix once the masonry is built and cured.',
    keywords: [
      'reglet flashing',
      'through-wall flashing',
      'cut-in reglet',
      'cast-in reglet',
      'surface-mounted reglet',
      'lead wedge flashing',
    ],
    source: 'afs-knowledge',
  },

  // ─────────────────────────────────────────────────────────────────
  // INSPECTION & COORDINATION
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'webkb-inspection-checklist',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Inspection and Coordination',
    topic: 'Common roofing inspection checklist items for flashing',
    content:
      'When AFS inspects existing flashing — whether on a service call, a pre-reroofing survey, or a routine maintenance walk — the same core items come up as the source of most real problems. Lap direction is checked first: every flashing lap should shed water downward and outward in a continuous shingle-style sequence, and a lap installed backward or interrupted at a transition is one of the most common root causes of an active leak. Fastener condition matters as much as fastener presence — corroded, backed-out, or missing fasteners at cleats and attachment points, and any exposed-fastener flashing where the gasketed washers have failed or gone missing, are checked individually rather than assumed fine because the flashing "looks" intact from a distance. Sealant and joint condition is checked at every expansion joint, lap joint, and termination — cracked, shrunk, or fully debonded sealant at a joint that was designed to rely on it is a near-certain active or imminent leak path. Signs of restricted thermal movement — visible buckling, oil-canning, or split seams on long runs — point to a rigid attachment or a missing expansion joint rather than a material defect, and are noted as a detailing issue to correct, not just a cosmetic flaw to patch. Galvanic compatibility is checked at every point where dissimilar metals meet or where runoff from one metal crosses another. Drainage components — gutters, scuppers, overflow provisions — are checked for actual water-carrying function, not just visual presence, since a gutter or scupper that is physically intact but clogged or improperly sloped provides no real drainage protection. Finally, membrane or roofing termination underneath edge metal and penetration flashing is checked wherever it can be safely accessed, since the metal itself is frequently sound while the termination beneath it has failed.',
    keywords: [
      'flashing inspection checklist',
      'roof inspection items',
      'lap direction check',
      'fastener condition inspection',
      'sealant condition check',
      'drainage inspection',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-flashing-failure-diagnosis',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Inspection and Coordination',
    topic: 'Flashing failure diagnosis and remediation',
    content:
      'AFS approaches flashing failure diagnosis by working backward from the water\'s actual path rather than assuming the leak originates at the nearest visible sign of damage — interior water staining or an active leak often shows up a meaningful distance from the true entry point, since water can travel along a structural member, a membrane surface, or inside a wall cavity before it becomes visible. The most common root causes, in the order AFS checks them, are: a lap installed against the shingle-style water-shedding direction rather than with it; a long metal run that was rigidly fixed at both ends with no thermal-movement accommodation, leading to a split seam or a pulled joint as the metal cycles through its full expansion range; a failed or undersized sealant joint at an expansion joint or termination that was never designed to be the primary waterproofing layer in the first place; an underbuilt or corroded cleat and nailer assembly at a roof edge, discovered only once the edge metal is removed for inspection; and dissimilar-metal galvanic corrosion at a contact point or in the runoff path below one. Remediation is only as good as the diagnosis behind it — resealing a joint or patching a visible gap without correcting the underlying cause (a missing expansion joint, a backward lap, an undersized cleat) reliably produces a repeat failure within one to a few seasons, which is why AFS documents and addresses the actual mechanism of failure rather than the most visible symptom of it. Where a failure traces back to a genuine detailing gap rather than a workmanship or material defect, AFS treats correcting the detail — not just replacing the failed material in kind — as part of the repair scope.',
    keywords: [
      'flashing failure diagnosis',
      'leak root cause',
      'flashing remediation',
      'repeat leak failure',
      'thermal movement failure',
      'detailing gap',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-flashing-installation-sequence',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Inspection and Coordination',
    topic: 'Flashing installation sequence on new construction',
    content:
      'Flashing has to be installed in a specific sequence relative to the roofing, wall, and adjacent trades\' work for the shingle-lap principle to actually function, and AFS coordinates that sequence explicitly on new construction rather than leaving it to be resolved in the field. At a roof-to-wall intersection, base flashing is installed integrated with or immediately following the roofing membrane it turns up from, before the counter flashing above it is set, so that the base flashing is fully lapped by the counter flashing rather than the reverse. At edge metal conditions, the wood nailer is set and inspected for secure structural anchorage before edge metal cleats are attached to it, and the roof membrane is terminated and adhered under the metal\'s roof-side flange before the metal is finally set and hemmed down, not after. At penetrations and curbs, the curb itself needs to be set at its final height and location before the surrounding roofing and base flashing are run up to it, since flashing a membrane around a curb that arrives after the roofing is complete forces a compromised, field-improvised detail. Counter flashing and reglet-set flashing generally represent the last step at a given location, installed after the masonry, roofing, and base flashing beneath them are complete and inspected, since counter flashing\'s entire function depends on lapping cleanly over finished work below it. AFS sequences its own fabrication and delivery schedule against this installation order — arriving on site with edge metal before the nailer inspection is complete, for example, creates pressure to install ahead of a step that should not be skipped, so coordination of delivery timing is treated as part of getting the installation sequence right, not a separate logistics concern.',
    keywords: [
      'flashing installation sequence',
      'flashing coordination schedule',
      'base flashing before counter',
      'nailer inspection sequence',
      'curb flashing sequence',
      'new construction flashing order',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-trade-coordination',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Inspection and Coordination',
    topic: 'Coordination of flashing with other trades',
    content:
      'Flashing sits at the boundary between trades almost by definition — it exists specifically at the places where a roof meets a wall, a wall meets a window, or a membrane meets a curb — which makes trade coordination as important to a successful flashing installation as the fabrication itself. With masonry, AFS coordinates reglet location and depth, through-wall flashing elevation, and weep hole spacing before the wall is built, since correcting a poorly placed reglet or a missing through-wall flashing course after the masonry has cured and been pointed is disruptive and costly compared to getting it right during construction. With waterproofing and roofing trades, AFS coordinates the specific overlap and termination detail at every base-flashing-to-membrane connection, confirming which trade\'s material laps over which at each transition, since an assumption that "the other trade will lap over mine" on both sides of the same joint produces a detail with no actual overlap at all. With glazing and window installation, sill and head flashing at openings has to be sequenced and detailed against the specific window system\'s own flashing flanges and the wall\'s water-resistive barrier, since window manufacturers\' own installation instructions frequently assume a specific flashing sequence that a generic detail will not automatically satisfy. With mechanical and roofing-equipment trades, curb height, location, and roofing-side clearance need to be locked in and communicated before equipment is set, not treated as fixed obstacles to flash around afterward. AFS treats submittal review and shop drawing coordination meetings as the primary tool for catching these interface conflicts before fabrication and installation begin, since a flashing detail that is correct in isolation can still fail if the adjacent trade\'s actual installed condition does not match what the flashing detail assumed it would be.',
    keywords: [
      'trade coordination',
      'masonry coordination flashing',
      'waterproofing coordination',
      'window flashing coordination',
      'mechanical curb coordination',
      'flashing interface conflicts',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-submittal-shop-drawing-coordination',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Inspection and Coordination',
    topic: 'Submittal and shop drawing coordination process',
    content:
      'AFS treats the submittal and shop drawing process as the point where most costly field conflicts get caught and resolved before they become expensive change orders, rather than as a paperwork formality to get through quickly. Shop drawings for AFS-fabricated flashing, coping, gutters, and panel systems show actual dimensions, gauge, seam and joint locations, expansion joint spacing, and attachment details specific to the project — not generic manufacturer literature — precisely so the architect, general contractor, and adjacent trades can check them against the real building conditions and their own scope before fabrication starts. AFS cross-references its own shop drawings against the roofing, waterproofing, masonry, and window submittals for the same project wherever those interfaces exist, flagging any mismatch — a counter flashing height that does not match the window head flashing it is supposed to lap over, or a coping profile that assumes a parapet width different from what the structural drawings show — for resolution before fabrication rather than discovering it during installation. Material and finish samples are submitted alongside shop drawings for any project with a specified color, coating tier, or patina appearance, since color and finish approval is far cheaper to correct on a physical sample than after a full fabrication run has been coil-coated or fabricated to a mismatched specification. AFS builds submittal review time into its fabrication schedule as a real project milestone, since compressing or skipping this step to save schedule time is one of the more common causes of field rework and delay on sheet metal scope, not a reliable way to actually save time overall.',
    keywords: [
      'shop drawing coordination',
      'submittal process',
      'flashing shop drawings',
      'material sample approval',
      'submittal review schedule',
      'fabrication coordination',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-copper-cleats-fasteners',
    category: '07 62 00 Sheet Metal Flashing and Trim',
    subcategory: 'Copper',
    topic: 'Copper cleat and fastener compatibility',
    content:
      'Every cleat and fastener that contacts copper on an AFS installation has to be copper, brass, or stainless steel — plain steel, aluminum, and standard galvanized fasteners are never used against copper, because contact between copper and any of those metals sets up galvanic corrosion that attacks the less-noble metal, often visibly within a few years of installation. Copper cleats are formed from the same or a slightly heavier gauge than the sheet they secure, and are spaced roughly 12 inches on center along a typical flashing, coping, or gutter run, adjusted tighter at corners, ends, and high-wind-exposure locations. Where a copper detail is fastened directly (rather than through a concealed cleat), AFS uses copper or silicon-bronze nails or screws, since standard zinc-plated or stainless fasteners not specifically rated for copper contact can still cause staining or accelerated wear at the fastener head over time even when the corrosion risk to the copper sheet itself is minor. Cleats are also the component that gives a copper installation its thermal-movement accommodation, so cleat spacing and slot design are treated as a movement-control decision, not just an attachment-strength one — cleats spaced or slotted too tightly restrict the panel\'s ability to slide as it expands and contracts, which defeats the purpose of using a floating cleat system in the first place. AFS specifies and stocks copper-compatible fasteners specifically for copper scope rather than relying on field crews to substitute a "close enough" standard fastener, since fastener compatibility is one of the easiest details to get wrong on an otherwise well-designed copper installation.',
    keywords: [
      'copper cleats',
      'copper fasteners',
      'silicon bronze fasteners',
      'copper cleat spacing',
      'copper fastener compatibility',
      'concealed cleat copper',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-standing-seam-clip-attachment',
    category: '07 61 00 Sheet Metal Roofing',
    subcategory: 'Metal Panel Systems',
    topic: 'Standing seam clip attachment schedules',
    content:
      'The clip is the single component that determines whether a standing seam roof performs correctly over its service life, since it is both the panel\'s only attachment to the structure and the mechanism that allows or restricts thermal movement, and AFS engineers clip type, spacing, and fastening as a coordinated set rather than treating them as independent choices. Fixed clips anchor the panel rigidly at one control point per run — typically the ridge, or another point chosen to control which direction the panel expands and contracts from — and every panel run needs exactly one; a run with no fixed clip has no controlled starting point for its movement, and a run with more than one fixed clip fights itself thermally between the two anchor points. Floating clips allow the panel to slide slightly along its length as it moves, either through a slotted clip body or a two-piece clip design that separates the deck-fastened base from the panel-engaging top, and make up the remainder of the clips along the run. Clip spacing is calculated from panel width, material gauge, and the project\'s specific wind and snow load requirements, generally falling in a 12 to 24 inch on-center range, tightened at eaves, ridges, and corners where wind uplift pressures are highest relative to the field of the roof. Clip material has to be compatible with the panel material under the same galvanic-compatibility rules that apply everywhere else in sheet metal work — a mismatched clip and panel material pairing introduces a corrosion risk at literally every attachment point on the roof, which is a far more consequential mistake than a mismatched fastener at a single isolated location.',
    keywords: [
      'standing seam clips',
      'fixed clip',
      'floating clip',
      'clip spacing schedule',
      'clip material compatibility',
      'panel attachment engineering',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-stainless-fasteners-flashing',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: 'Steel',
    topic: 'Stainless steel fasteners and trim in sheet metal flashing',
    content:
      'Stainless steel occupies a useful middle position in the galvanic series, which is why AFS specifies it as the default fastener and cleat material whenever a project mixes materials or the specific base metal compatibility has not been fully worked out at the detailing stage — stainless is compatible with copper, aluminum, and both galvanized and painted steel, without the sharp incompatibilities that rule out plain steel or aluminum fasteners in copper work, or copper fasteners in aluminum work. Beyond fasteners, AFS fabricates some architectural trim and accent details directly in stainless sheet where its appearance, strength, or corrosion resistance in an aggressive environment (coastal, industrial, or chemical-exposure sites) is specifically wanted, though stainless commands a real cost premium over galvanized or painted carbon steel and is reserved for applications where that premium is justified rather than used as a default upgrade. Type 304 stainless is the standard architectural grade AFS uses for general exterior fastener and trim work; Type 316, which includes molybdenum for improved resistance to chloride-driven corrosion, is stepped up to on coastal or de-icing-salt-exposed projects where 304 would be expected to pit or corrode prematurely. Stainless fasteners still need to be matched to the correct head style, coating, and finish for the visible or concealed condition they are used in — a bright, highly reflective stainless fastener head can be visually distracting on an otherwise matte-finished painted panel, so AFS specifies painted-head or color-matched stainless fasteners for exposed-fastener applications where appearance matters.',
    keywords: [
      'stainless steel fasteners',
      'Type 304 stainless',
      'Type 316 stainless',
      'stainless trim',
      'coastal fastener corrosion',
      'mixed material fastener compatibility',
    ],
    source: 'afs-knowledge',
  },
  {
    id: 'webkb-expansion-joint-covers',
    category: '07 95 00 Expansion Control',
    subcategory: 'Metal Panel Systems',
    topic: 'Expansion joint cover design in metal panel and flashing systems',
    content:
      'An expansion joint cover is the formed metal component that spans a deliberate gap in a long roof, wall panel, coping, or fascia run, concealing the gap while still allowing the metal on either side of it to move independently as it expands and contracts. AFS details expansion joint covers in two general families: a batten-cover design, where a raised formed cover engages both sides of the gap with enough overlap and slack to accommodate the full range of expected movement without binding or pulling free at either extreme of the temperature range; and a lapped slip-joint design, where one piece simply overlaps the other with enough engagement depth that thermal movement never pulls the lap apart, commonly used on lower-profile conditions like coping and fascia where a raised batten cover is not the desired appearance. Joint gap width and cover overlap are both sized from the actual anticipated thermal movement of the specific metal, color, and run length on either side of the joint — a joint sized adequately for a shorter aluminum run will not necessarily be adequate if reused without recalculation on a longer run or a darker color that runs hotter in the sun. Expansion joint covers are never sealed rigidly on both sides with sealant, since doing so defeats the purpose of the joint by pinning the two sides together exactly the way a rigid, unbroken run would; where sealant is used at an expansion joint cover, it is applied only in a way that preserves the cover\'s ability to slide, typically at a single fixed edge with the opposite edge left free to move underneath a lapped or gasketed cover.',
    keywords: [
      'expansion joint cover',
      'batten cover design',
      'slip joint',
      'joint gap sizing',
      'expansion joint sealant',
      'panel run expansion joint',
    ],
    source: 'afs-knowledge',
  },
];
