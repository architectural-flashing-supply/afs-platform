import type { KnowledgeChunk } from './types';

// CSI MasterFormat Division 07 — Thermal and Moisture Protection.
// Scoped to the sections relevant to AFS's fabrication business: sheet
// metal roofing/flashing/trim/drainage/wall panels, roof specialties and
// accessories, joint protection, plus cross-cutting installation
// standards and field failure modes. Content is reference-grade summary
// for chatbot grounding, not a substitute for SMACNA/NRCA/project specs.
export const division7Knowledge: KnowledgeChunk[] = [
  // ─────────────────────────────────────────────────────────────────
  // 07 61 00 — SHEET METAL ROOFING
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-061-standing-seam',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 61 00 Sheet Metal Roofing',
    topic: 'Standing seam systems',
    content:
      'Standing seam roofing is a concealed-fastener system where adjacent panels are joined by vertical seams that stand up from the roof plane, typically 1" to 2" tall. Seams may be mechanically field-formed (single-lock or double-lock, using a seamer machine) or snap-together (factory-formed male/female legs that interlock by hand pressure). Double-lock standing seam is the highest-performing mechanical seam and is standard for low-slope or high-wind applications; single-lock is acceptable for steeper slopes with lower wind exposure. Panels attach to the deck via concealed clips that allow the panel to float and expand/contract with temperature — panels are never face-fastened through the field. Clip spacing is typically 12"–24" o.c. depending on panel width, gauge, and wind/snow load, per SMACNA and the panel manufacturer engineering. Common widths run 12"–24"; narrower panels resist oil-canning better on long runs.',
    keywords: [
      'standing seam',
      'double lock',
      'single lock',
      'snap lock',
      'concealed fastener',
      'seamer',
      'roof panel',
      'clip spacing',
      'metal roofing',
    ],
  },
  {
    id: 'div7-061-batten-flat-snap',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 61 00 Sheet Metal Roofing',
    topic: 'Batten seam, flat lock, and snap lock panels',
    content:
      'Batten seam roofing uses a raised wood or metal batten strip at each panel joint, covered by a formed batten cap — a traditional profile common on historic and high-end architectural copper/zinc roofs, prized for its strong shadow line. Flat lock (also called flat seam) roofing uses small, individually soldered or crimped panels (commonly 18"–24" square) folded and locked together on all four edges, producing a smooth, low-profile surface historically used on low-slope copper roofs and dormers where standing seams would be visually intrusive; flat lock requires soldering at every seam on copper and is labor-intensive. Snap lock panels are a factory-formed variant of standing seam where the male and female legs snap together by hand without a mechanical seamer, speeding installation but generally rated for lower wind uplift than mechanically double-locked seams — appropriate for sloped, lower-exposure roofs rather than high-wind or low-slope conditions.',
    keywords: [
      'batten seam',
      'flat lock',
      'flat seam',
      'snap lock',
      'soldered panel',
      'historic roofing',
      'copper roof',
    ],
  },
  {
    id: 'div7-061-gauges-thermal',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 61 00 Sheet Metal Roofing',
    topic: 'Material gauges and thermal movement design for roofing',
    content:
      'Roofing panel thickness is specified by material-specific gauge/weight systems: copper by ounces per square foot (16oz/20oz/24oz), aluminum by decimal gauge (.032"/.040"/.050"), steel and stainless by standard gauge number (24ga/22ga/20ga). Heavier gauge resists oil-canning and hail damage but adds cost and weight. Every metal roof system must accommodate thermal expansion and contraction along its length — panels are never rigidly fixed at both ends. Design accounts for the total anticipated temperature swing at the site (surface temperatures on a dark metal roof can exceed ambient by 50°F+) using each material\'s coefficient of thermal expansion, with floating clips, elongated clip slots, and expansion seams at panel run breaks (typically every 30\'–40\' on long runs) to relieve movement stress without buckling panels or tearing seams.',
    keywords: [
      'gauge',
      'thickness',
      'thermal movement',
      'expansion',
      'contraction',
      'coefficient of thermal expansion',
      'oil canning',
      'panel run',
    ],
  },
  {
    id: 'div7-061-underlayment-fastening',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 61 00 Sheet Metal Roofing',
    topic: 'Underlayment requirements and fastening patterns',
    content:
      'Metal roofing requires a compatible underlayment beneath the panels — high-temperature self-adhering membrane (rated for the elevated under-panel temperatures metal roofs generate) is standard, with slip-sheet or synthetic underlayment used in some assemblies to allow thermal movement without underlayment adhesion dragging on the panel. Underlayment selection must also confirm chemical compatibility with the specific metal (some asphaltic membranes can stain or corrode copper and zinc — a rosin paper or specified slip-sheet separator layer is used under those metals). Fastening is always through the concealed clip system in the field of standing seam panels; perimeter conditions (eaves, ridges, rakes) use cleats and starter strips fastened per SMACNA pattern requirements, with fastener spacing tightened at edges and corners per wind uplift design (roof perimeter and corner zones see substantially higher uplift pressures than the field per ASCE 7 wind provisions).',
    keywords: [
      'underlayment',
      'high temp underlayment',
      'slip sheet',
      'fastening pattern',
      'cleat',
      'starter strip',
      'wind uplift zones',
    ],
  },
  {
    id: 'div7-061-ridge-eave',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 61 00 Sheet Metal Roofing',
    topic: 'Ridge and eave details',
    content:
      'Ridge caps at standing seam roofs cover the panel-to-panel transition at the roof peak, typically formed to clip or hook over the terminated panel seams with a minimum overlap per SMACNA (commonly 4"–6" of ridge cap engagement), and require closure strips (foam or formed metal) to block wind-driven rain and pest entry at the corrugation profile while still allowing ventilation where the ridge is vented. Eave details terminate the low end of the panel run with a formed drip edge or eave cleat that directs water off the roof and away from the fascia, engaging the roofing underlayment so water cannot get behind the panel at the low edge; a continuous cleat (rather than face-fastening the panel edge) preserves the concealed-fastener performance of the system all the way to the drip.',
    keywords: [
      'ridge cap',
      'eave',
      'closure strip',
      'drip edge',
      'eave cleat',
      'roof termination',
      'vented ridge',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 07 62 00 — SHEET METAL FLASHING AND TRIM
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-062-base-counter-cap',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 62 00 Sheet Metal Flashing and Trim',
    topic: 'Base flashing, counter flashing, and cap flashing',
    content:
      'Base flashing is the lower component of a two-part flashing assembly at a roof-to-wall or roof-to-curb intersection — it turns up the vertical surface from the roof membrane and is typically integrated with or lapped over by the roofing material itself. Counter flashing (also called cap flashing in some usage) is the upper component that laps down over the base flashing, embedded or fastened into the wall above (via a reglet, through-wall termination, or surface mount) so that water running down the wall face is thrown clear of the base flashing joint rather than driven behind it. Counter flashing must overlap base flashing by a minimum of 4" per standard practice, and is installed after the base flashing so the lap sheds water downward in the correct shingle-style direction. This two-part separation lets the counter flashing be removed and reset (e.g., during reroofing) without disturbing the roof membrane seal below.',
    keywords: [
      'base flashing',
      'counter flashing',
      'cap flashing',
      'roof to wall',
      'two-part flashing',
      'overlap',
      'reglet',
    ],
  },
  {
    id: 'div7-062-step-valley',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 62 00 Sheet Metal Flashing and Trim',
    topic: 'Step flashing and valley flashing',
    content:
      'Step flashing consists of individual L-shaped metal pieces (typically 5"–10" long) woven in with each course of roofing material along a sloped roof-to-wall intersection, each piece overlapping the one below by a minimum of 2"–3" and extending up the wall for counter flashing to lap over — one piece per shingle/course, never a single continuous strip, so the assembly can accommodate roof-plane movement without tearing. Valley flashing lines the internal V formed where two roof slopes meet, carrying concentrated runoff from both planes; open valleys expose a wide (typically 20"–24") metal valley pan with the roofing held back on each side by several inches, while closed/woven valleys interlace the roofing material itself over a narrower metal valley liner. Valley metal should be one continuous length where possible, or lapped a minimum of 6"–8" with the upper piece over the lower, and requires a formed center rib or crimp in wide-open valleys to prevent cross-valley wash during heavy flow.',
    keywords: [
      'step flashing',
      'valley flashing',
      'open valley',
      'closed valley',
      'woven valley',
      'valley pan',
      'roof to wall',
    ],
  },
  {
    id: 'div7-062-reglets-reveals',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 62 00 Sheet Metal Flashing and Trim',
    topic: 'Reglets and reveals',
    content:
      'A reglet is a slot formed into (or surface-mounted onto) masonry, concrete, or other wall substrate that receives the top edge of counter flashing, allowing it to be tucked in and secured (typically with lead wedges or sealant) so it reads as a clean, continuous termination. Masonry-cut reglets are sawn into the mortar joint or face of existing masonry and are common on retrofit/reroofing work; surface-mounted reglets are fastened to the wall face and sealed along the top edge, used where saw-cutting isn\'t practical or on new construction where the reglet can be built into the wall assembly from the start. A reveal is a shadow-line joint — an intentional reveal gap or stepped trim condition — used architecturally at panel-to-panel or panel-to-wall transitions to express a clean termination line; reveal trims must still maintain positive drainage and weather separation behind the reveal gap, not just a visual effect.',
    keywords: [
      'reglet',
      'surface mount reglet',
      'masonry cut reglet',
      'reveal',
      'counter flashing termination',
      'lead wedge',
    ],
  },
  {
    id: 'div7-062-through-wall',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 62 00 Sheet Metal Flashing and Trim',
    topic: 'Through-wall flashing',
    content:
      'Through-wall flashing is installed within a masonry cavity wall or veneer assembly, spanning from the exterior face (as a drip edge/weep condition) back through the wall to the interior wythe or air/vapor barrier, intercepting and redirecting water that penetrates the outer wythe back out through weep holes before it can reach the building interior. It is required at shelf angles, above and below openings, at the base of the wall, and at parapets — any location where the cavity is interrupted. Minimum embed into the wall assembly is typically 4" past the interior face of the outer wythe (or per manufacturer/engineer requirement), with a positive slope to the exterior (minimum 1/4" per foot, per AFS system guidance) so water does not pond within the flashing. End dams are required at the terminations of every through-wall flashing run to prevent water from running off the ends into the wall cavity, and laps between flashing pieces must be sealed (not just overlapped) to maintain a continuous water plane.',
    keywords: [
      'through wall flashing',
      'cavity wall',
      'weep holes',
      'shelf angle',
      'end dam',
      'embed',
      'masonry veneer',
    ],
  },
  {
    id: 'div7-062-head-sill-jamb',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 62 00 Sheet Metal Flashing and Trim',
    topic: 'Head flashing, sill flashing, and jamb flashing',
    content:
      'Head flashing is installed above window and door openings, extending back into the wall assembly and turned up at the ends to form a dam that directs water running down the wall out and away from the top of the opening rather than into it — it must lap over (be behind) the wall cladding above and lap in front of (over) the window/door frame or flexible flashing below. Sill flashing (often called pan flashing when formed as a full sloped tray) sits beneath the opening, sloped to drain outward with upturned end dams and back dam, catching any water that gets past the window/door and directing it back out before it can reach the rough framing. Jamb flashing runs vertically along the sides of the opening, tying the head flashing and sill flashing together into a continuous drainage plane; all three must integrate with the wall\'s water-resistive barrier in correct shingle-lap sequence — sill first, then jambs, then head, then the WRB lapped over the head flashing — so water always sheds down and out at every transition.',
    keywords: [
      'head flashing',
      'sill flashing',
      'jamb flashing',
      'pan flashing',
      'window flashing',
      'door flashing',
      'end dam',
      'back dam',
    ],
  },
  {
    id: 'div7-062-parapet-expansion-penetration',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 62 00 Sheet Metal Flashing and Trim',
    topic: 'Parapet flashing, expansion joint flashing, and penetration flashing',
    content:
      'Parapet flashing wraps the top and sides of a parapet wall, typically as a coping cap over the top with base/counter flashing addressing the roof-to-parapet intersection below — this is one of the highest wind-exposure and highest-consequence flashing conditions on a building and is a common source of leaks when under-designed. Expansion joint flashing bridges movement joints in the structure (building expansion joints, not just thermal seams in the metal itself) with a cover assembly designed to accommodate structural movement — bellows-type, slide-plate, or telescoping covers — without tearing or losing the water seal; these are engineered to the joint\'s actual anticipated movement, not a standard flashing detail. Penetration flashing addresses any object that punctures the roof or wall plane — pipes, curbs, conduits, equipment supports — typically using a formed metal flange or boot that laps correctly with the surrounding roofing/wall material and a cricket (diverter) upslope of any penetration wider than about 24" to split water flow around it rather than damming behind it. Cant strips (triangular filler pieces) are used at base flashing transitions to ease the roofing membrane\'s turn from horizontal to vertical, reducing stress at that bend line.',
    keywords: [
      'parapet flashing',
      'expansion joint flashing',
      'penetration flashing',
      'pipe flashing',
      'curb flashing',
      'cricket',
      'cant strip',
      'roof penetration',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 07 63 00 — SHEET METAL DRAINAGE
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-063-gutters',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 63 00 Sheet Metal Drainage',
    topic: 'Gutters — K-style, box, and half-round',
    content:
      'K-style gutters have a decorative ogee front profile resembling crown molding and are the most common residential/light-commercial gutter shape, typically fabricated in 5" and 6" widths. Box gutters are simple rectangular-profile gutters, often built larger (6"–10"+) for commercial and architectural applications, and may be built into the roof edge structure itself (a true "built-in" box gutter) rather than hung externally. Half-round gutters have a semicircular profile, historically associated with traditional and high-end residential architecture, typically paired with round downspouts and round-strap hangers rather than the bracket hangers used on K-style. Gutter material selection follows the same options as roofing/flashing (copper, aluminum, galvanized, stainless, zinc) and should be compatible with the roofing metal draining into it to avoid galvanic issues.',
    keywords: [
      'gutter',
      'K-style gutter',
      'box gutter',
      'half round gutter',
      'built-in gutter',
      'ogee profile',
    ],
  },
  {
    id: 'div7-063-downspouts-heads',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 63 00 Sheet Metal Drainage',
    topic: 'Downspouts, conductor heads/leader heads, and splash blocks',
    content:
      'Downspouts carry water from the gutter or roof drain down the face of the building to grade or a below-grade drainage system, fabricated in rectangular (corrugated or smooth) or round profiles matching the gutter style; rectangular downspouts are more common on commercial work for their higher capacity per size and ease of wall-mounting, while round downspouts pair with half-round gutters. Conductor heads (also called leader heads) are the funnel-shaped collector box at the top of a downspout, typically used where a roof drain, scupper, or box gutter outlet needs to transition into a smaller downspout — they also serve an overflow function, since a correctly sized conductor head will pond briefly and spill before the downspout backs up the whole system, and are often a decorative architectural element with cast or embossed detailing. Splash blocks (or splash pads) are placed at the downspout\'s discharge point at grade to disperse water and prevent soil erosion or foundation splashing where the downspout doesn\'t tie directly into a drainage pipe.',
    keywords: [
      'downspout',
      'conductor head',
      'leader head',
      'splash block',
      'rectangular downspout',
      'round downspout',
      'overflow',
    ],
  },
  {
    id: 'div7-063-scuppers-overflow',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 63 00 Sheet Metal Drainage',
    topic: 'Scuppers and overflow drains',
    content:
      'Scuppers are openings through a parapet or wall that allow water to drain off a low-slope roof at the perimeter rather than (or in addition to) through interior roof drains — they may be through-wall (a sleeve or formed metal box passing entirely through the parapet to discharge outside the building line) or surface-mount. Every primary drainage system on a low-slope roof requires a secondary/overflow path per code — either overflow scuppers set slightly higher than the primary drainage line, or overflow (secondary) roof drains — sized so that if the primary system is blocked, the roof cannot pond to a depth that threatens structural capacity. Overflow scuppers are typically set 2" above the roof\'s low point/primary drain elevation and must be sized independently to handle the full design rainfall event on their own, not just supplement the primary system.',
    keywords: [
      'scupper',
      'through wall scupper',
      'overflow drain',
      'overflow scupper',
      'secondary drainage',
      'parapet drainage',
      'roof ponding',
    ],
  },
  {
    id: 'div7-063-sizing-slope-hangers',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 63 00 Sheet Metal Drainage',
    topic: 'Gutter sizing, slope requirements, expansion provisions, and hanger spacing',
    content:
      'Gutter and downspout sizing follows local plumbing/building code rainfall-intensity tables (based on roof catchment area and the local 100-year, 1-hour rainfall rate) — undersized gutters overflow in heavy rain regardless of how well they\'re installed. Gutters are sloped toward their outlets, typically a minimum of 1/16" to 1/8" per foot, to keep water moving and prevent standing water that accelerates corrosion and debris buildup; long gutter runs slope from a high point at the center toward outlets at each end, or continuously to a single end outlet on shorter runs. Expansion joints (formed slip-joint covers, not just a butted seam) are required in long continuous gutter runs — typically every 40\'–50\' depending on material — since a rigid gutter run will buckle or split its seams with thermal cycling otherwise. Hangers (brackets, straps, or spikes-and-ferrules depending on gutter style) are spaced per manufacturer/SMACNA requirement, commonly 24"–36" o.c., tightened up in high snow-load or ice regions.',
    keywords: [
      'gutter sizing',
      'rainfall intensity',
      'gutter slope',
      'expansion joint gutter',
      'hanger spacing',
      'gutter hangers',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 07 65 00 — FLEXIBLE FLASHING
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-065-self-adhering',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 65 00 Flexible Flashing',
    topic: 'Self-adhering membranes at metal terminations',
    content:
      'Self-adhering flexible flashing membranes (rubberized asphalt or butyl-based, with a release-paper backing) are used at the terminations and transitions where rigid sheet metal flashing meets the building\'s water-resistive barrier — they bridge the gap between a rigid metal edge and a flexible wall membrane so the drainage plane stays continuous. Common uses include lapping over the top leg of counter flashing before the WRB continues up the wall, wrapping metal flange edges at penetrations, and sealing the transition where a metal reglet or termination bar meets the substrate. Compatibility matters: some asphaltic self-adhering membranes will stain, corrode, or chemically attack copper, zinc, and lead-coated copper — a compatible membrane (or a slip-sheet/isolation layer) must be confirmed for those metals rather than defaulting to a generic asphaltic product.',
    keywords: [
      'self adhering membrane',
      'flexible flashing',
      'rubberized asphalt',
      'butyl membrane',
      'WRB integration',
      'membrane compatibility',
    ],
  },
  {
    id: 'div7-065-rough-opening-pan',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 65 00 Flexible Flashing',
    topic: 'Window and door rough opening flashing and pan flashing',
    content:
      'Rough opening flashing for windows and doors combines flexible self-adhering membrane at the jambs and head with a sloped pan (either a formed metal pan or a flexible membrane pan built up in the field) at the sill — the pan is the single most important element, since it catches water that bypasses the window/door unit itself and drains it back out over the wall cladding rather than into the wall cavity or down into the framing below. Proper sequencing (shingle-lap order) is: sill pan first, then jamb flexible flashing overlapping the pan\'s upturned ends, then the window/door unit set into the opening, then head flashing (rigid metal preferred over flexible alone at the head, since it sheds water rather than just resisting it) lapped by the WRB above. A rigid, factory-formed sill pan is generally preferred over an entirely field-built flexible pan for its reliable corners and consistent slope, though both approaches are used depending on the specified system.',
    keywords: [
      'rough opening flashing',
      'window flashing',
      'door flashing',
      'sill pan',
      'pan flashing',
      'shingle lap sequence',
      'flexible flashing window',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 07 66 00 — SHEET METAL WALL PANELS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-066-rainscreen-reveal-soffit',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 66 00 Sheet Metal Wall Panels',
    topic: 'Rainscreen panels, reveal panels, and soffit panels',
    content:
      'Rainscreen wall panels are mounted on a ventilated air gap (typically 3/4"–1") over the building\'s primary water-resistive barrier, on the principle that the panel itself is not expected to be perfectly watertight — any water that gets behind it drains and evaporates through the cavity rather than reaching the structure, and the air gap also equalizes pressure to reduce wind-driven water intrusion at the joints. Reveal panels are flat or lightly formed metal panels installed with a deliberate shadow-line reveal gap at each joint (rather than a tight seam or batten cover), used for a clean architectural look — the reveal gap still needs a drainage strategy behind it, typically the same rainscreen cavity principle. Soffit panels close the underside of roof overhangs, canopies, and similar horizontal-to-the-ground surfaces; they are commonly perforated or louvered where attic/cavity ventilation is required, and must be detailed to shed condensation and incidental water without collecting it in a horizontal plane.',
    keywords: [
      'rainscreen',
      'reveal panel',
      'soffit panel',
      'wall panel',
      'ventilated cavity',
      'pressure equalization',
      'cladding',
    ],
  },
  {
    id: 'div7-066-clip-thermal-vent',
    category: '07 60 00 Flashing and Sheet Metal',
    subcategory: '07 66 00 Sheet Metal Wall Panels',
    topic: 'Clip systems, thermal bridging, and ventilation requirements for wall panels',
    content:
      'Wall panel clip systems (Z-girts, hat channels, or proprietary clip-and-rail attachment) space the panel off the wall substrate to create the rainscreen cavity and carry the panel\'s dead load and wind load back to the structure — clip spacing and gauge are engineered to the specific panel size, material, and the project\'s wind load, not a one-size-fits-all detail. Continuous metal clips or girts that penetrate a continuous insulation layer create thermal bridging (a path for heat to bypass the insulation), which is addressed with thermally broken clips, intermittent (rather than continuous) attachment points, or a thermal break material between the clip and the substrate on high-performance envelope projects. Ventilation at the top and bottom of the rainscreen cavity (or at intervals on tall walls) allows the cavity to actually drain and dry — a rainscreen cavity that is sealed airtight at top and bottom loses most of its performance benefit, since trapped moisture has nowhere to evaporate to.',
    keywords: [
      'clip system',
      'girt',
      'thermal bridging',
      'thermal break',
      'ventilation cavity',
      'wall panel attachment',
      'continuous insulation',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 07 71 00 — ROOF SPECIALTIES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-071-coping-material-sizing',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Coping Caps',
    topic: 'Coping cap material selection and sizing',
    content:
      'Coping caps cap the top of a parapet wall, and their material should be selected for the building\'s exposure and the wall material below (masonry parapets commonly use copper, lead-coated copper, or heavy-gauge aluminum/stainless; coordinate with any dissimilar-metal contact points at the wall). Coping cap width must fully cover the parapet with adequate overhang on both the exterior and interior (roof) sides — minimum 3" overhang each side is standard practice, giving the drip edge enough standoff from the wall face to keep water from wicking back onto the masonry, and enough interior overhang to shed cleanly onto the roof or into a gutter rather than dripping down the inside wall face.',
    keywords: [
      'coping cap',
      'coping material',
      'parapet cap',
      'coping overhang',
      'coping sizing',
      'minimum overhang',
    ],
  },
  {
    id: 'div7-071-coping-slope-drip',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Coping Caps',
    topic: 'Coping cap slope and drip edge requirements',
    content:
      'Coping caps must be sloped to shed water toward the roof side (never toward the exterior wall face) — a minimum slope of 1/8" per foot toward the roof is standard AFS guidance, formed into the coping profile itself rather than relying on shimming in the field. Both the exterior and interior legs of the coping require a formed drip edge (a hemmed or kicked-out lower edge) so water releases cleanly off the metal instead of running back underneath and along the wall face by surface tension — a coping cap without a drip edge is one of the most common causes of staining and long-term masonry deterioration directly below the coping line, even when the cap itself isn\'t leaking.',
    keywords: [
      'coping slope',
      'coping drip edge',
      'parapet drainage',
      'minimum slope',
      'drip formation',
    ],
  },
  {
    id: 'div7-071-coping-cleats-joints',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Coping Caps',
    topic: 'Coping cap cleat attachment, expansion joint spacing, joint covers, and end dams',
    content:
      'Coping caps should be attached via concealed continuous cleats on both the exterior and interior legs (front cleat and back cleat), not face-fastened — face fasteners through the top or face of a coping cap are a direct leak path and a wind-uplift weak point. Expansion joints are required along the coping run to accommodate thermal movement — maximum spacing of approximately 10 feet for copper and aluminum coping is standard guidance (tighter spacing for darker/higher-heat-gain finishes), using a joint cover plate that laps both adjacent coping sections and allows them to move independently underneath it. End dams are required at every termination, corner, and joint location where water could otherwise run off the end of a coping run into the wall assembly below — without an end dam, even a well-sloped, well-cleated coping run can dump water directly into the parapet at its ends.',
    keywords: [
      'coping cleat',
      'front cleat',
      'back cleat',
      'expansion joint spacing',
      'joint cover',
      'end dam',
      'coping attachment',
    ],
  },
  {
    id: 'div7-071-coping-wind-failures',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Coping Caps',
    topic: 'Coping cap wind uplift design and common failure modes',
    content:
      'Coping caps sit in one of the highest wind-uplift zones on a building (parapet/roof-edge corner and perimeter zones per ASCE 7 and SMACNA wind design tables) and must be engineered — cleat gauge, fastener spacing, and cleat engagement depth — to that specific pressure, not a generic detail carried over from a lower-exposure project. The most common real-world coping failures are: wind uplift from missing or under-spaced cleats, or cleats with insufficient engagement/hook depth that release under negative pressure; inadequate slope (installed flat or reverse-sloped) that lets water pond and eventually finds a way through a seam or fastener; and missing or poorly detailed end dams and expansion joint covers that let water bypass an otherwise sound cap. Wind uplift design should reference SMACNA\'s Architectural Sheet Metal Manual tables for the project\'s specific wind zone and building height/exposure category.',
    keywords: [
      'wind uplift design',
      'coping failure',
      'SMACNA wind tables',
      'cleat engagement',
      'corner zone',
      'perimeter zone',
      'ASCE 7',
    ],
  },
  {
    id: 'div7-071-gravel-stop',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Gravel Stops',
    topic: 'Gravel stops — face height, flange, nailer, and wind uplift testing',
    content:
      'Gravel stops are roof-edge metal terminations for low-slope membrane roofs (a step up from a plain drip edge) with a vertical face that both retains ballast/gravel on built-up roofs and provides a clean, positive termination and integration point for the roofing membrane. Face height is selected based on the roof edge detail and any ballast retention need, and the flange (the horizontal leg that ties into the roof membrane) requires a minimum of about 4" for reliable membrane integration/stripping-in. A continuous wood or metal nailer anchored to the structural roof edge is required to fasten the gravel stop\'s inner flange securely — the nailer is what actually resists uplift, not the sheet metal alone. Gravel stops (and roof edge metal generally) on most commercial projects are required to be tested and rated per ANSI/SPRI ES-1, which establishes the wind uplift testing methodology and pass criteria for roof edge systems; specifying an ES-1-tested assembly (rather than an ad hoc detail) is standard commercial practice. Expansion provisions (joint covers at intervals, matching the coping guidance above) are also required on long gravel stop runs.',
    keywords: [
      'gravel stop',
      'roof edge metal',
      'face height',
      'flange',
      'nailer',
      'ANSI SPRI ES-1',
      'wind uplift testing',
      'stripping ply',
    ],
  },
  {
    id: 'div7-071-fascia',
    category: '07 71 00 Roof Specialties',
    subcategory: 'Fascia',
    topic: 'Fascia — height limitations, attachment, expansion, and drip formation',
    content:
      'Fascia covers the exposed edge of a roof structure (rafter tails, roof deck edge, or a gravel-stop\'s exterior face) for both weather protection and appearance. Allowable fascia face height is limited by gauge and the project\'s wind exposure — taller fascia faces need heavier gauge and closer fastening/cleat spacing to resist wind load and oil-canning, and manufacturer or SMACNA tables should be checked rather than assuming a height is acceptable in a given gauge. Attachment is typically via a combination of a top cleat (concealed) and bottom cleat or fastening into the fascia board/nailer, with expansion joints on long runs matching the same thermal-movement logic as coping and gutters. A formed drip edge at the bottom of the fascia (a hemmed or kicked-out lower lip) ensures water releases cleanly rather than wicking back under the fascia onto the soffit or wall below.',
    keywords: [
      'fascia',
      'fascia height',
      'fascia attachment',
      'fascia expansion',
      'fascia drip edge',
      'roof edge fascia',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 07 72 00 — ROOF ACCESSORIES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-072-expansion-covers',
    category: '07 72 00 Roof Accessories',
    subcategory: 'Expansion Joint Covers',
    topic: 'Expansion joint covers — movement calculation and cover types',
    content:
      'Roof (and wall/deck) expansion joint covers bridge a structural movement joint in the building itself — a much larger and more critical movement than ordinary thermal expansion of the sheet metal, since it accommodates actual building frame movement (seismic, thermal, or settlement-driven). The cover must be sized to the joint\'s calculated total anticipated movement (thermal movement of the structure across the joint, plus any seismic or dynamic movement per the structural engineer), not an assumed standard width. Common cover types: bellows-type covers (a flexible, accordion-folded membrane or metal bellows that stretches/compresses with the joint — good for larger movement ranges), slide-plate covers (a metal cover plate that overlaps a fixed base and slides across it as the joint moves — simpler, but limited to smaller movement and needs a clean, unobstructed slide path), and double-sided (two-piece, center-split) covers used where movement needs to be split symmetrically from a fixed centerline. Substrate on both sides of the joint must be properly prepared and flashed into the roofing/waterproofing membrane before the cover is installed, since the cover itself is not always the sole water barrier.',
    keywords: [
      'expansion joint cover',
      'movement joint',
      'bellows expansion joint',
      'slide plate cover',
      'building movement',
      'seismic joint',
    ],
  },
  {
    id: 'div7-072-curbs',
    category: '07 72 00 Roof Accessories',
    subcategory: 'Prefabricated Curbs',
    topic: 'Prefabricated curbs — height, compatibility, cant, and flashing integration',
    content:
      'Prefabricated roof curbs support rooftop equipment (HVAC units, skylights, hatches, vents) above the roof membrane, raising the equipment base high enough to keep it out of standing water and above the roofing\'s flashing height. Minimum curb height is typically 8" above the finished roof surface (higher in heavy-snow regions or where roof drains could back up), measured from the finished roof (not the deck) so the actual clearance accounts for insulation and membrane thickness already installed. Curb material should be compatible with both the roofing membrane/flashing metal and the equipment it supports to avoid galvanic or chemical interaction at the flashing interface. A cant strip is typically used at the curb\'s base-to-roof transition (same principle as base flashing cants elsewhere) to ease the membrane\'s bend at that corner. Flashing integration follows the same base-flashing-plus-counter-flashing logic as any other roof penetration — the roofing membrane is flashed up and onto the curb, and a counter-flashing or storm collar at the equipment connection keeps water from tracking down into the curb-to-equipment joint.',
    keywords: [
      'roof curb',
      'prefabricated curb',
      'curb height',
      'equipment curb',
      'cant strip curb',
      'curb flashing',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 07 90 00 — JOINT PROTECTION
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-090-sealant-compatibility',
    category: '07 90 00 Joint Protection',
    subcategory: 'Sealants',
    topic: 'Sealant compatibility with sheet metals',
    content:
      'Sealant chemistry must be matched to the metal it will contact. Polyurethane sealants are broadly compatible with all common architectural sheet metals (copper, aluminum, galvanized steel, stainless, zinc) and are a safe general-purpose choice for metal-to-metal and metal-to-masonry joints. Neutral-cure silicone is also compatible across all of those metals and offers excellent UV/weathering durability, making it a common choice for exposed exterior joints. Acetoxy-cure silicone (the common "vinegar-smelling" hardware-store silicone) is NOT compatible with copper or lead-coated copper — the acetic acid released during cure attacks and corrodes those metals, and its use should be avoided entirely on copper/lead-coated-copper work; specify neutral-cure silicone or polyurethane instead. Butyl tape (a non-curing, permanently tacky sealant tape) is used for concealed, compressed joints — seam laps, panel-to-panel splices under fasteners, and other locations where a gasket-style seal under compression is more appropriate than a tooled bead of wet sealant.',
    keywords: [
      'sealant compatibility',
      'polyurethane sealant',
      'silicone sealant',
      'neutral cure silicone',
      'acetoxy cure',
      'butyl tape',
      'copper sealant',
    ],
  },
  {
    id: 'div7-090-joint-design',
    category: '07 90 00 Joint Protection',
    subcategory: 'Joint Design',
    topic: 'Joint design principles, backing rod, and finishing',
    content:
      'Sealant should never be relied on as the primary water barrier in a flashing assembly — it is a secondary, supplementary seal on top of correctly lapped, sloped, and shingled sheet metal work; a detail that only works because of a bead of sealant is not a sound flashing detail. Proper joint geometry is required regardless of sealant quality: adequate joint width for the anticipated movement, and a backing rod (closed-cell foam rod) sized at roughly a 2:1 width-to-depth ratio, which both controls the sealant\'s depth (too-deep sealant cures poorly and performs worse under movement) and prevents three-sided adhesion (bonding to the back of the joint in addition to both sides), which would restrict the sealant\'s ability to stretch and compress with joint movement. Sealant must be tooled to a smooth, slightly concave or flush finish immediately after application (before skinning) for both appearance and to ensure full contact with the joint sides — a bead that is simply extruded and left untooled has poor adhesion and a shorter service life.',
    keywords: [
      'joint design',
      'backing rod',
      'width to depth ratio',
      'three sided adhesion',
      'tooling sealant',
      'primary water barrier',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // INSTALLATION STANDARDS
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-install-end-laps',
    category: 'Installation Standards',
    subcategory: 'Laps',
    topic: 'End lap requirements',
    content:
      'All sheet metal flashing requires a minimum 3" end lap where two pieces join in the same plane (e.g., successive lengths of coping, gutter, fascia, valley, or through-wall flashing) — this is a baseline minimum, and specific conditions (high-exposure roof edges, through-wall flashing at critical junctures) may call for more per the governing spec or engineer. Laps should always be sealed or soldered, not just physically overlapped and left dry, unless the detail is specifically designed as a shingle-lap drainage joint where the overlap direction alone is sufficient (as with step flashing courses). The upper/upstream piece always laps over the lower/downstream piece in the direction of water flow, never the reverse.',
    keywords: [
      'end lap',
      'minimum lap',
      '3 inch lap',
      'lap direction',
      'shingle lap',
      'flashing joints',
    ],
  },
  {
    id: 'div7-install-thermal-expansion',
    category: 'Installation Standards',
    subcategory: 'Thermal Movement',
    topic: 'Thermal expansion rates by material',
    content:
      'Different sheet metals expand and contract at different rates and must be detailed accordingly. Approximate linear thermal movement per 10 linear feet across a typical temperature range: copper moves about 1/8" per 10 LF; aluminum moves about 3/16" per 10 LF (aluminum has a notably higher expansion coefficient than the other common architectural metals, meaning aluminum work needs more frequent expansion joints or looser cleat engagement); galvanized steel moves about 1/10" per 10 LF; stainless steel also moves about 1/10" per 10 LF. These figures drive maximum unsupported/unjointed run lengths, cleat and clip engagement tolerances, and expansion joint spacing across every application in this knowledge base (coping, gutters, roofing panel runs, wall panels) — always check the specific detail\'s expansion joint spacing against the actual metal being used rather than applying a copper-based rule of thumb to aluminum or vice versa.',
    keywords: [
      'thermal expansion rate',
      'copper expansion',
      'aluminum expansion',
      'galvanized expansion',
      'stainless expansion',
      'linear movement',
      'expansion per 10 feet',
    ],
  },
  {
    id: 'div7-install-dissimilar-metals',
    category: 'Installation Standards',
    subcategory: 'Galvanic Compatibility',
    topic: 'Dissimilar metals — galvanic series and isolation requirements',
    content:
      'When two dissimilar metals are in electrical contact in the presence of moisture, the less noble (more anodic) metal corrodes preferentially — the galvanic series ranks metals by nobility, and the further apart two metals sit on that series, the more aggressive the corrosion of the less-noble one. Copper is strongly incompatible with aluminum and zinc — runoff water from a copper roof or flashing that washes across aluminum or zinc components downstream will accelerate corrosion of those metals even without direct contact (this is why copper should never drain directly onto aluminum gutters, fasteners, or wall panels). Stainless steel must be isolated from carbon/galvanized steel in direct contact for the same reason. Isolation is achieved with a physical barrier — a compatible non-conductive membrane, gasket, or coating — at any point two incompatible metals would otherwise touch, and by routing drainage so runoff from a more-noble metal (like copper) does not wash across a less-noble one downstream.',
    keywords: [
      'dissimilar metals',
      'galvanic series',
      'galvanic corrosion',
      'isolation',
      'copper aluminum incompatibility',
      'copper zinc incompatibility',
      'runoff corrosion',
    ],
  },
  {
    id: 'div7-install-fastening',
    category: 'Installation Standards',
    subcategory: 'Fastening',
    topic: 'Fastening — concealed vs. exposed, and compatible fastener metals',
    content:
      'Concealed fastening (cleats, clips, hidden fastening under a lapped or seamed joint) is preferred wherever the detail allows, since every exposed fastener penetration is a potential leak path and a point of differential thermal movement stress. Where exposed fastening is unavoidable (some trim terminations, retrofit conditions), fasteners should be gasketed and their material matched to the same galvanic-compatibility rule as the metals they join. Stainless steel fasteners are required with stainless steel or copper flashing/roofing — using plain carbon-steel or galvanized fasteners with copper or stainless will corrode at the fastener location, staining the surrounding metal and eventually failing. As a general rule, fasteners should be the same metal as (or more noble than, and never significantly less noble than) the base metal they\'re securing.',
    keywords: [
      'fastening',
      'concealed fastener',
      'exposed fastener',
      'stainless fasteners',
      'fastener compatibility',
      'gasketed fastener',
    ],
  },
  {
    id: 'div7-install-soldering',
    category: 'Installation Standards',
    subcategory: 'Soldering',
    topic: 'Soldering requirements for copper work',
    content:
      'Soldered seams (flat lock roofing, some copper gutter and downspout joints, certain coping and cap flashing corners) use tin-lead solder with a rosin flux on copper — rosin flux is non-corrosive and safe to leave residue from, unlike acid flux, which must never be used on architectural copper work (acid flux residue will continue etching/corroding the copper after the joint is made if not fully neutralized and cleaned, and is generally reserved for plumbing pipe work, not exposed architectural sheet metal). Surfaces must be mechanically cleaned bright and flux-coated immediately before soldering — oxidized or contaminated copper will not take solder reliably. Adequate heat (typically from a properly sized soldering iron/copper, not a torch, for architectural work) is required to draw solder fully through the joint by capillary action rather than just puddling on the surface, and the joint should be cleaned of flux residue after soldering to prevent long-term staining or corrosion at the seam.',
    keywords: [
      'soldering',
      'tin-lead solder',
      'rosin flux',
      'acid flux',
      'soldered seam',
      'copper soldering',
      'flat lock solder',
    ],
  },
  {
    id: 'div7-install-seam-types',
    category: 'Installation Standards',
    subcategory: 'Seams',
    topic: 'Seam types — flat lock, standing seam, batten seam, Pittsburgh lock, double lock',
    content:
      'Flat lock seams fold and interlock adjoining sheet edges into a flush, low-profile joint, typically soldered on copper for a fully sealed seam — used on flat-lock roofing and some flush trim conditions. Standing seam (see 07 61 00 above) raises the seam vertically off the roof plane; it may be single-lock (one fold, hand or machine formed, adequate for steeper-slope/lower-exposure conditions) or double-lock (two folds, machine-seamed, the highest-performing and most weathertight mechanical seam, standard for low-slope or high-wind roofing). Batten seam (see 07 61 00 above) covers the panel joint with a separate formed cap over a raised batten. Pittsburgh lock (also called a Pittsburgh seam) is a mechanically formed corner/box seam used extensively in duct and box fabrication and in some sheet metal trim corners — one edge is formed into a hook, the other into a matching pocket, and they are driven/hammered together for a tight, largely self-sealing mechanical joint without solder.',
    keywords: [
      'seam types',
      'flat lock seam',
      'standing seam',
      'batten seam',
      'Pittsburgh lock',
      'double lock seam',
      'single lock seam',
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // FAILURE MODES
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'div7-fail-oil-canning',
    category: 'Failure Modes',
    subcategory: 'Oil-Canning',
    topic: 'Oil-canning — definition, causes, and prevention',
    content:
      'Oil-canning is the visible waviness or "bowing" of a flat metal panel surface — an optical/cosmetic phenomenon caused by minor stresses in the material (from forming, handling, or thermal cycling) that flat sheet metal is naturally prone to displaying, especially on wide, unribbed panel faces under certain lighting angles. It is not usually a structural or water-tightness defect, but it is a common source of complaint on flat coping, fascia, and wall panel work. Causes: insufficient gauge for the panel width (thinner material shows waviness more readily), inadequate allowance for thermal expansion (a panel fighting against restrained movement will bow), and simply wide, flat, unbroken panel faces with nothing to interrupt the eye or add stiffness. Prevention: use a heavier gauge for wide panels, add stiffening beaks/ribs/striations to break up the flat face and add rigidity, and limit unbroken flat panel width (narrower panels or panels with a center break/rib are far less prone to visible oil-canning than a single wide flat face of the same material).',
    keywords: [
      'oil canning',
      'panel waviness',
      'oil canning causes',
      'oil canning prevention',
      'stiffening rib',
      'stiffening beak',
      'flat panel bowing',
    ],
  },
  {
    id: 'div7-fail-wind-uplift',
    category: 'Failure Modes',
    subcategory: 'Wind Uplift Failures',
    topic: 'Wind uplift failures — coping cap and gravel stop',
    content:
      'Coping cap wind uplift failures most commonly trace back to missing or under-spaced concealed cleats, cleats with insufficient hook/engagement depth that release under negative pressure, or fasteners/cleats sized for field-zone wind pressure when the coping actually sits in a higher-pressure corner or perimeter zone per ASCE 7/SMACNA. Once a section releases at one point, wind can get underneath and progressively peel back adjacent sections. Gravel stop wind uplift failures commonly result from an inadequate or missing continuous nailer (the sheet metal alone, without a solid anchored nailer behind the fastening flange, cannot resist real uplift loads), or missing/insufficient stripping plies (the roofing membrane layers that tie the gravel stop\'s flange into the roof system) — a gravel stop that is only mechanically fastened without being properly stripped-in by the membrane is vulnerable to both wind uplift and water infiltration at the flange edge.',
    keywords: [
      'wind uplift failure',
      'coping failure cause',
      'gravel stop failure',
      'missing cleats',
      'stripping ply failure',
      'nailer failure',
    ],
  },
  {
    id: 'div7-fail-corrosion',
    category: 'Failure Modes',
    subcategory: 'Corrosion',
    topic: 'Corrosion — galvanic, crevice, and pitting',
    content:
      'Galvanic corrosion occurs when dissimilar metals are in contact (or connected by runoff) in the presence of moisture — see Installation Standards above for the galvanic series and isolation requirements; remediation requires physically isolating the metals and, if damage has already occurred, replacing the corroded (less-noble) component. Crevice corrosion occurs in tight, poorly drained gaps — under washers, in overlapped-but-unsealed laps, behind debris buildup — where moisture becomes trapped and stagnant, creating a locally aggressive corrosion cell even on a metal that performs fine in open exposure; remediation involves opening/re-detailing the crevice to drain and dry, or sealing it fully so moisture can\'t enter at all (a half-measure that lets water in but not out is worse than either extreme). Pitting corrosion is localized, deep, small-diameter attack typically seen on stainless steel in chloride-rich environments (coastal salt air, deicing salt exposure) where the passive oxide layer breaks down at isolated points; remediation includes upgrading to a higher-chloride-resistant grade (316 over 304) in marine exposure and more frequent cleaning to remove chloride deposits before they concentrate.',
    keywords: [
      'corrosion',
      'galvanic corrosion',
      'crevice corrosion',
      'pitting corrosion',
      'chloride corrosion',
      'corrosion remediation',
    ],
  },
  {
    id: 'div7-fail-fatigue',
    category: 'Failure Modes',
    subcategory: 'Fatigue Cracking',
    topic: 'Fatigue cracking — thermal cycling and vibration',
    content:
      'Fatigue cracking in sheet metal flashing and roofing develops from repeated cyclic stress rather than a single overload event — most commonly from thermal cycling (daily and seasonal expansion/contraction) at a location where the detail did not provide adequate expansion relief, concentrating the movement stress at one seam, fastener, or bend repeatedly until the metal work-hardens and cracks. Vibration-driven fatigue occurs near mechanical equipment (rooftop units, generators, fans) where flashing or curb-adjacent trim is subjected to continuous low-amplitude vibration rather than thermal cycling — this calls for isolation (resilient mounts, slip joints) between the vibrating equipment and the rigid flashing/curb work, rather than a rigid connection that transmits the vibration directly into the metal.',
    keywords: [
      'fatigue cracking',
      'thermal cycling fatigue',
      'vibration fatigue',
      'metal fatigue',
      'work hardening',
      'equipment vibration',
    ],
  },
  {
    id: 'div7-fail-ponding',
    category: 'Failure Modes',
    subcategory: 'Ponding',
    topic: 'Ponding — causes and remediation',
    content:
      'Ponding water on a low-slope roof or within a drainage component (gutter, valley, coping, through-wall flashing) accelerates membrane and metal degradation, adds structural dead load, and increases the risk of leaks finding their way through any small defect since standing water has time and hydrostatic pressure a quickly-shedding roof does not. Common causes: insufficient slope built into the original design or lost over time as the structure settles/deflects; blocked or undersized drains, scuppers, or gutters (debris, ice, or simple under-capacity for the actual rainfall); and failed expansion joints or seams that create a low spot or dam where water collects instead of continuing to flow. Remediation ranges from cleaning/unblocking drainage paths (the simplest and most common actual fix), to adding tapered insulation or crickets to redirect flow away from a chronic low spot, to replacing an undersized drainage component entirely when the underlying cause is capacity rather than a blockage or defect.',
    keywords: [
      'ponding',
      'ponding water',
      'roof ponding causes',
      'insufficient slope',
      'blocked drain',
      'ponding remediation',
      'tapered insulation',
    ],
  },
  {
    id: 'div7-fail-sealant',
    category: 'Failure Modes',
    subcategory: 'Sealant Failure',
    topic: 'Sealant failure — wrong product, poor joint design, UV degradation',
    content:
      'The most common sealant failure is simply the wrong product for the substrate — most notably acetoxy-cure silicone on copper (see Joint Protection above), but also using a sealant not rated for the specific joint\'s expected movement range. Improper joint design (no backing rod, incorrect width-to-depth ratio, three-sided adhesion trapping the sealant so it cannot flex) causes even a correctly chosen sealant to tear or debond prematurely under normal thermal movement. UV degradation is a normal end-of-service-life failure mode for most sealants (breakdown, cracking, and loss of elasticity from prolonged sun exposure) — expected service life varies by product (a decade or more for quality polyurethane/silicone in a properly designed joint) and periodic inspection/replacement should be planned rather than treating sealant as a permanent, install-once component. Remediation always starts with removing the failed sealant completely and re-preparing the joint (correct backing rod, clean bonding surfaces) rather than tooling a fresh bead over failed material.',
    keywords: [
      'sealant failure',
      'UV degradation',
      'sealant service life',
      'wrong sealant',
      'sealant remediation',
      'joint failure',
    ],
  },
];
