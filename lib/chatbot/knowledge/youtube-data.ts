import type { KnowledgeChunk } from './types';

// AFS-authored technical guidance on core sheet metal fabrication and
// installation topics — original content grounded in industry-standard
// practice (SMACNA, NRCA, ANSI/SPRI, ASTM), written as AFS's own field
// guidance for chatbot grounding. Not derived from or attributed to any
// external source.
export const youtubeKnowledge: KnowledgeChunk[] = [
  {
    id: 'afs-guidance-copper-flashing',
    category: 'Technical Guidance',
    subcategory: 'Copper Flashing',
    topic: 'AFS Technical Guidance — Copper Flashing Installation Best Practices',
    content:
      'Copper is one of the longest-lasting architectural sheet metal materials but requires installation practices specific to its chemistry and thermal behavior. Fasteners, cleats, and any metal in direct contact with copper must be copper, brass, or stainless steel — never plain steel, aluminum, or galvanized fasteners, which will corrode rapidly through galvanic action when in contact with copper in the presence of moisture. Copper should never be installed in direct contact with chemically treated lumber (ACQ and similar preservatives are corrosive to copper); a slip sheet or rosin paper separator is required between copper and treated wood substrates. Because copper has a relatively high coefficient of thermal expansion, panels and flashing runs longer than roughly 8 to 10 feet need an expansion accommodation — a loose-lock seam, a formal expansion joint, or slotted cleat fastening — rather than continuous rigid fixing, per SMACNA\'s expansion joint spacing tables. Cleats should be concealed and spaced approximately 12 inches on center, with headlaps on horizontal joints of at least 4 inches. Copper develops a natural weathering patina over time; runoff from unweathered or partially weathered copper carries dissolved copper salts that can stain or accelerate corrosion of aluminum, painted steel, or masonry surfaces downstream, so copper details should be designed so runoff sheds away from incompatible finish materials below rather than across them. Seams intended to be fully watertight should be soldered using proper flux and a hot iron rather than sealant alone.',
    keywords: ['copper flashing', 'copper installation', 'galvanic corrosion', 'copper cleats', 'copper expansion', 'copper patina', 'treated lumber copper', 'soldered seam'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-standing-seam',
    category: 'Technical Guidance',
    subcategory: 'Standing Seam Roofing',
    topic: 'AFS Technical Guidance — Standing Seam Metal Roofing Installation',
    content:
      'Standing seam performance depends on panel attachment allowing free thermal movement rather than rigid, face-through fastening. Panels are secured to the deck with concealed clips — a fixed clip at a single anchor point (typically the ridge or a defined control point) and floating clips everywhere else — so each panel can expand and contract along its length without buckling or pulling apart at the seams. Seam type should match the roof slope and exposure: mechanically double-locked seams, formed with a seaming machine after panel installation, provide the highest wind and water resistance and are required on low-slope applications, generally below a 3:12 pitch; single-lock seams suit steeper, lower-exposure roofs; snap-lock panels install fastest but carry lower wind uplift ratings and should be reserved for sloped, moderate-exposure conditions. Clip spacing is governed by panel width, gauge, and project-specific wind and snow load calculations, typically 12 to 24 inches on center — this should be engineered per SMACNA and the panel\'s tested attachment schedule, not assumed. Underlayment matters as much as the panel: self-adhered ice and water shield is required at eaves, valleys, and penetrations in cold-climate applications as a backup against wind-driven rain and ice damming. End laps, ridge closures, and eave trim must be detailed to allow the same expansion the field panels are designed for — a rigid ridge or eave detail that pins both ends of a long panel run is one of the most common causes of standing seam oil-canning and seam failure.',
    keywords: ['standing seam', 'metal roofing installation', 'double lock seam', 'floating clip', 'clip spacing', 'snap lock', 'oil canning', 'ice and water shield'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-coping-cap',
    category: 'Technical Guidance',
    subcategory: 'Coping',
    topic: 'AFS Technical Guidance — Coping Cap Installation Requirements',
    content:
      'Coping caps cap and protect the top of a parapet wall and are a high-consequence detail — a coping failure allows water directly into the wall assembly below. Coping should be installed on a continuous cleat system: a front cleat engaging a hemmed front edge, and a rear leg either engaging a second cleat or fastened through a wood nailer or receiver concealed under the cap, so no fasteners are exposed on the finished face. The cap should be sloped toward the interior of the roof, typically a minimum of 1/4 inch per foot, so wind-driven water sheds back onto the roof rather than staining the exterior wall face. Coping runs longer than about 10 to 12 feet require a joint system that accommodates thermal movement — either a batten-cover expansion joint or an overlapping lap joint with sealant and backer rod at a deliberate gap — rather than continuous, unbroken lengths, which will buckle. Both the front and back edges of the coping leg should be hemmed for stiffness and to conceal the cleat engagement. On projects in high-wind zones or governed by FM Global insurance requirements, the coping assembly — cap, cleat, and fastening pattern together, not just the metal gauge — should be tested and rated to ANSI/SPRI ES-1 or FM 4435, since wind uplift failures typically start at an under-engineered cleat or fastening pattern rather than the cap metal itself.',
    keywords: ['coping cap', 'coping installation', 'continuous cleat', 'parapet coping', 'coping joint', 'ANSI SPRI ES-1 coping', 'coping slope'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-wall-roof-intersection',
    category: 'Technical Guidance',
    subcategory: 'Wall-to-Roof Transitions',
    topic: 'AFS Technical Guidance — Sheet Metal Flashing at Wall/Roof Intersections',
    content:
      'Where a roof plane meets a vertical wall, the correct flashing method depends on the roof slope. On sloped, shingled or panelized roofing, step flashing — individual L-shaped pieces interleaved with each course of roofing material as the roof is installed — is the standard method, since it lets water shed over each piece in sequence rather than relying on a single long joint. On low-slope or membrane roofing, a continuous base flashing turned up the wall (a minimum of 8 inches above the roof surface is a common baseline, though project specs and code may require more) and extended onto the roof deck at least 4 inches is paired with a separate counter flashing, set into the wall above and lapped down over the base flashing by at least 4 inches, so the two pieces can move independently. Two details are frequently missed and are common sources of leaks and wall rot: kickout flashing, a diverter installed at the low end where a roof-wall intersection terminates at a gutter, which directs water outward into the gutter instead of letting it run down behind the wall cladding; and a cricket or saddle flashing upslope of any wide obstruction or wall run, which splits water flow around the obstruction rather than letting it pond against it. Both should be treated as required details on any roof-wall intersection, not optional add-ons.',
    keywords: ['wall roof intersection', 'step flashing', 'base flashing', 'kickout flashing', 'cricket flashing', 'roof wall transition', 'diverter flashing'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-gutter',
    category: 'Technical Guidance',
    subcategory: 'Gutters and Drainage',
    topic: 'AFS Technical Guidance — Gutter Installation and Sizing',
    content:
      'Gutter capacity has to be sized to the actual roof area it drains, not selected by habit. Sizing should reference a rainfall-intensity-based table, such as SMACNA\'s, that accounts for the roof\'s drainage area, the local design storm rainfall rate, and the roof\'s pitch, then match that to a gutter profile and downspout size with adequate outlet capacity — an undersized gutter or downspout will overflow in a heavy storm regardless of how well it is installed. Gutters should be sloped toward their outlets, typically a minimum of about 1/16 inch of fall per foot of run, so water does not stand and accelerate corrosion or ice damage at low points. Hangers should be spaced per the gutter size and expected load — commonly every 24 to 36 inches, tighter in regions with significant snow and ice loading — and fastened into solid backing, not just fascia trim. Long, continuous gutter runs need expansion joints or slip-joint connections at intervals set by material and color, since dark, high-heat-absorbing finishes need tighter spacing than light colors, following the same thermal-movement logic as any other long sheet metal run; a gutter fastened rigidly along its full length will pull apart at seams or joints over time. Outlets should be sized to the downspout and protected with a strainer or leaf guard appropriate to the site\'s debris load, since a clogged outlet defeats correct sizing everywhere else in the system.',
    keywords: ['gutter installation', 'gutter sizing', 'downspout sizing', 'gutter slope', 'gutter hangers', 'gutter expansion joint', 'gutter capacity'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-z-bar',
    category: 'Technical Guidance',
    subcategory: 'Z-Bar and Pitch Breaks',
    topic: 'AFS Technical Guidance — Z-Bar and Pitch Change Installation',
    content:
      'Z-bar, sometimes called Z-flashing, is a Z-profile trim used anywhere a horizontal break occurs in a vertical or sloped metal surface and water needs to be shed over the joint rather than through it — most commonly at horizontal siding or panel transitions, and at pitch breaks on a metal roof where the slope changes from steeper to shallower. The upper leg of the Z-bar laps over the top of the lower panel or siding course, and the lower leg tucks behind or laps over the top of the next course down, so the assembly sheds water by gravity at every break rather than depending on sealant to bridge the joint. Laps at a Z-bar transition should be a minimum of 2 to 3 inches, more on lower-slope applications, and all exposed edges should be hemmed both for rigidity and to eliminate a sharp raw edge that can cut installers or trap water by capillary action. On low-slope or high-wind applications, a bead of butyl sealant or sealant tape at the Z-bar-to-panel interface adds a secondary line of defense, but should never substitute for correct lap and slope. As with any other long horizontal trim run, a Z-bar should not be rigidly face-fastened through both the panel above and the panel below without allowing for differential thermal movement between the two, particularly at pitch breaks where panel runs on each side of the break may be different lengths and therefore move different amounts.',
    keywords: ['z-bar', 'z-flashing', 'pitch change flashing', 'pitch break', 'panel transition flashing', 'z-bar lap'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-counter-flashing',
    category: 'Technical Guidance',
    subcategory: 'Counter Flashing',
    topic: 'AFS Technical Guidance — Counter Flashing and Reglet Installation',
    content:
      'Counter flashing works as a pair with base flashing, and the fundamental principle is that the two pieces must remain independently movable while staying lapped and watertight. Base flashing is tied to the roof and moves with roof deck deflection and thermal cycling; counter flashing is anchored to the wall above and stays fixed relative to the wall. A reglet is the slot or receiver the counter flashing\'s top edge is set into. There are two common types: a cut-in reglet, raked into an existing masonry mortar joint and secured with lead wedges or a sealant bead, and a surface-mounted reglet, a separate metal receiver fastened to the face of the wall — surface-mounted reglets are the more practical choice on retrofit work where cutting into existing masonry is not desirable. Whichever type is used, the counter flashing\'s top edge should be inserted a minimum of about 1 inch into the reglet and sealed continuously along the top. The bottom edge of the counter flashing should overlap the base flashing by at least 4 inches and should be hemmed for stiffness. Critically, the counter flashing should never be face-fastened down through both itself and the base flashing into the roof deck — doing so eliminates the independent movement the two-piece system is designed to provide and is a common cause of split seams and leaks at wall-roof terminations after repeated thermal cycles.',
    keywords: ['counter flashing', 'reglet', 'cut-in reglet', 'surface mounted reglet', 'base flashing overlap', 'counter flashing installation'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-valley-flashing',
    category: 'Technical Guidance',
    subcategory: 'Valley Flashing',
    topic: 'AFS Technical Guidance — Valley Flashing Installation Methods',
    content:
      'An open metal valley is generally the more durable choice compared to a woven or closed valley, particularly on higher-value roofing systems, because the metal channel carries water independently of the roofing material laid alongside it. Valley metal should run the full length from ridge to eave in the fewest practical pieces, with upper pieces overlapping lower pieces by a minimum of about 6 inches in the direction of water flow. Total valley width should be sized to the roof slopes feeding into it, commonly in the 20 to 24 inch range, with a minimum exposed metal width of roughly 4 to 6 inches on each side of centerline after the roofing material is trimmed back — narrower exposures are appropriate only on steeper, lower-volume valleys. On wide valleys carrying significant water volume, a center rib or slight standing seam formed down the middle of the valley metal prevents water from one slope crossing over and running up under the roofing on the opposite slope during heavy rain, which is a common cause of valley leaks on flat-profiled valley metal. Fasteners and cleats should be kept entirely out of the water channel, positioned only at the outer edges under the roofing material, never through the exposed metal itself. Self-adhered ice and water shield underlayment should run the full width of the valley beneath the metal as a secondary barrier.',
    keywords: ['valley flashing', 'open valley', 'valley metal', 'valley width', 'center rib valley', 'valley underlayment', 'roof valley installation'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-gravel-stop',
    category: 'Technical Guidance',
    subcategory: 'Gravel Stop',
    topic: 'AFS Technical Guidance — Gravel Stop Installation at Low-Slope Roofs',
    content:
      'A gravel stop is the edge metal at the perimeter of a low-slope built-up or membrane roof — it retains ballast or gravel surfacing where used, terminates the roof membrane, and forms the finished roof edge, making it one of the highest wind-uplift-risk details on the building. Attachment should follow the same continuous-cleat principle as coping: a concealed cleat engages a hemmed front edge so the face has no exposed fasteners, with the metal fastened to a wood nailer at the roof perimeter that is sized to match the roof insulation thickness and securely anchored to the structural deck. The roof membrane itself must be properly terminated and adhered under the gravel stop\'s roof-side flange per the membrane manufacturer\'s detail — the metal edge is only as watertight as the membrane termination beneath it. Because gravel stops sit at the roof perimeter where wind uplift pressures are highest, the complete assembly — metal, cleat, fastening pattern, and nailer attachment together, not the metal gauge alone — should be tested and rated to ANSI/SPRI ES-1 or FM 4435 for the project\'s design wind pressure. Long gravel stop runs need the same joint treatment as coping: lap joints or formal expansion joints spaced roughly every 10 to 12 feet, since a rigid, unbroken perimeter run is prone to buckling as it heats and cools through the day.',
    keywords: ['gravel stop', 'gravel stop installation', 'low slope roof edge', 'roof edge metal', 'membrane termination', 'wind uplift roof edge', 'ANSI SPRI ES-1 gravel stop'],
    source: 'afs-knowledge',
  },
  {
    id: 'afs-guidance-thermal-expansion',
    category: 'Technical Guidance',
    subcategory: 'Thermal Movement',
    topic: 'AFS Technical Guidance — Thermal Expansion in Sheet Metal Systems',
    content:
      'Every sheet metal material expands and contracts with temperature, but not at the same rate — copper and aluminum move significantly more per degree of temperature change than steel over an equivalent length, and dark-colored finishes absorb more solar heat and see larger temperature swings than light-colored finishes on the same material. Over a long run, this adds up to real, measurable movement: a 20-foot copper run can move on the order of 3/16 to 1/4 inch or more across a typical seasonal or day-to-night temperature swing, and a rigidly fixed installation has nowhere for that movement to go. The practical design responses are all variations on the same principle — give the metal somewhere to move rather than fighting it: expansion joints at intervals set by material and color per SMACNA\'s tables, loose-lock or slip-type seams instead of continuous rigid seams on long runs, slotted cleats or elongated fastener holes rather than tight-fitting fasteners, and floating clip systems, as used on standing seam roofing, instead of face-fastening panels directly to the deck. The single most common root cause of oil-canning, seam splitting, and buckled trim in fabricated sheet metal work is a long run that was rigidly fixed at both ends with no expansion accommodation in between — when evaluating a failed installation or reviewing a detail before fabrication, checking for this is usually the first and most productive place to look.',
    keywords: ['thermal expansion', 'thermal movement', 'expansion joint spacing', 'sheet metal expansion', 'oil canning cause', 'coefficient of thermal expansion', 'seam failure'],
    source: 'afs-knowledge',
  },
];
