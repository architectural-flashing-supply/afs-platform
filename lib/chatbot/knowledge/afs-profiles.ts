import type { KnowledgeChunk } from './types';

// AFS-specific product/profile knowledge — what each profile is, when
// it's used, typical configuration, materials AFS fabricates it in, and
// how a customer orders it (mirrors the ROUTING RULES in
// app/api/chat/route.ts's CHATBOT_SYSTEM_PROMPT: any profile, standard or
// complex/custom geometry or cleats → /studio/draft (FlashDraft),
// drawings/photos → /studio). Never include pricing —
// customers see prices only after a formal AFS-generated quote.
export const afsProfilesKnowledge: KnowledgeChunk[] = [
  {
    id: 'profile-coping-cap',
    category: 'AFS Profiles',
    subcategory: 'Roof Edge',
    topic: 'Coping Cap',
    content:
      'Coping cap is the formed metal cover for the top of a parapet wall, protecting the wall assembly below from water intrusion at the most exposed edge of the roof. Used on any parapet — flat roof commercial buildings, decorative parapets on sloped-roof buildings, screen walls around rooftop equipment. Typical configuration includes the parapet width plus a minimum 3" overhang on both the exterior and interior (roof) legs, a hemmed drip edge on both legs, and built-in slope toward the roof side. AFS fabricates coping cap in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify the parapet width (top-of-wall dimension), material/gauge, and finish; FlashDraft (/studio/draft) handles it directly, whether it\'s a straight run with standard overhangs, mitered corners, custom overhang dimensions for unusual parapet conditions, or integrated cleats/joint covers for wind zones.',
    keywords: ['coping cap', 'coping', 'parapet cap', 'parapet flashing', 'roof edge'],
  },
  {
    id: 'profile-base-flashing',
    category: 'AFS Profiles',
    subcategory: 'Wall/Roof Transition',
    topic: 'Base Flashing',
    content:
      'Base flashing is the lower component of a two-part roof-to-wall flashing assembly, turning up from the roof plane and integrating with the roofing material, to be lapped by counter flashing above. Used anywhere a roof meets a vertical wall, curb, or parapet base. Typical configuration is a formed angle with a roof-side leg (sized to the required membrane lap) and a wall-side leg (sized to extend up behind the counter flashing, commonly 4"+ of overlap). AFS fabricates base flashing in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify the wall-side and roof-side leg dimensions, material, and gauge; FlashDraft (/studio/draft) handles it directly, including cant-strip-integrated profiles and custom leg lengths for unusual wall/roof geometry — or a drawing upload if a formal takeoff is preferred.',
    keywords: ['base flashing', 'roof to wall flashing', 'wall base flashing'],
  },
  {
    id: 'profile-counter-flashing',
    category: 'AFS Profiles',
    subcategory: 'Wall/Roof Transition',
    topic: 'Counter Flashing',
    content:
      'Counter flashing is the upper component of a two-part roof-to-wall flashing assembly, lapping down over base flashing and anchored into the wall above (via reglet, through-wall embed, or surface mount) so water is thrown clear of the base flashing joint. Used in every location base flashing is used — they are a matched pair. Typical configuration is an angle or formed profile with a wall-anchoring leg (reglet-receiver style, or a flat surface-mount flange) and a lower leg sized to overlap the base flashing by a minimum of 4". AFS fabricates counter flashing in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify whether it\'s surface-mount or reglet-receiver style, the overlap dimension, material, and gauge — FlashDraft (/studio/draft) handles it directly, including reglet-style variations (masonry-cut vs. surface-mounted reglet) and custom wall conditions.',
    keywords: ['counter flashing', 'cap flashing', 'reglet flashing'],
  },
  {
    id: 'profile-step-flashing',
    category: 'AFS Profiles',
    subcategory: 'Wall/Roof Transition',
    topic: 'Step Flashing',
    content:
      'Step flashing consists of individual L-shaped pieces woven into each course of roofing along a sloped roof-to-wall intersection (typically where a sloped roof meets a chimney, dormer, or side wall). Used on shingle, shake, tile, or metal-shingle sloped roofing at any wall intersection. Typical configuration is small L-shaped pieces, commonly 5"–10" long, sized to the roofing course exposure, with each piece overlapping the one below by 2"–3". AFS fabricates step flashing in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify piece length, roof-side leg and wall-side leg dimensions, quantity (based on the total run length divided by course exposure), material, and gauge — FlashDraft (/studio/draft) handles it directly, including custom or unusually shaped step flashing (e.g., for an irregular course pattern).',
    keywords: ['step flashing', 'chimney flashing', 'dormer flashing'],
  },
  {
    id: 'profile-valley-flashing',
    category: 'AFS Profiles',
    subcategory: 'Roofing',
    topic: 'Valley Flashing',
    content:
      'Valley flashing lines the internal V where two roof slopes meet, carrying concentrated runoff from both roof planes. Used on any sloped roof with an internal valley condition. Typical configuration for open valleys is a wide pan, commonly 20"–24", often with a formed center rib or crimp to prevent cross-valley wash; closed/woven valleys use a narrower liner concealed beneath the roofing courses. AFS fabricates valley flashing in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify valley width, center rib/crimp option, length, material, and gauge — FlashDraft (/studio/draft) handles it directly, including unusual valley widths, multiple valley intersections, or hip-valley combinations — or a drawing/photo upload for complex conditions.',
    keywords: ['valley flashing', 'open valley', 'closed valley', 'roof valley'],
  },
  {
    id: 'profile-drip-edge',
    category: 'AFS Profiles',
    subcategory: 'Roof Edge',
    topic: 'Drip Edge (L-type, T-type, F-type)',
    content:
      'Drip edge is roof-edge metal that directs water off the roof deck cleanly at eaves and rakes, protecting the underlying deck edge and fascia from water intrusion. Used at every sloped roof perimeter as a baseline roof-edge detail. AFS fabricates three common drip edge types: L-type (a simple L-shaped angle, the most basic profile, used where a minimal, low-profile edge treatment is sufficient), T-type (a T-shaped profile with a longer vertical face, used where a more substantial edge or fascia-integrated look is wanted), and F-type (an F-shaped profile combining a roof-deck flange with a taller front face and a formed drip, often used where drip edge doubles as a gutter-apron condition feeding directly into a gutter below). Materials: copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify type (L/T/F), face height, flange width, material, and gauge — FlashDraft (/studio/draft) handles all three types directly, including custom face heights or integrated gutter-apron combinations.',
    keywords: ['drip edge', 'L-type drip edge', 'T-type drip edge', 'F-type drip edge', 'roof edge metal', 'gutter apron'],
  },
  {
    id: 'profile-gravel-stop',
    category: 'AFS Profiles',
    subcategory: 'Roof Edge',
    topic: 'Gravel Stop',
    content:
      'Gravel stop is roof-edge metal for low-slope membrane roofs with a vertical face that retains ballast and provides a clean membrane termination and integration point. Used on built-up, modified bitumen, and single-ply membrane low-slope roofs. Typical configuration is a formed profile with a roof-side flange (minimum 4" for reliable membrane stripping-in) and a vertical face sized to the roof edge detail, fastened to a continuous nailer. AFS fabricates gravel stop in copper, aluminum, galvanized steel, stainless, and Galvalume, and can fabricate to ANSI/SPRI ES-1 wind uplift design parameters. To order: specify face height, flange width, material, and gauge — FlashDraft (/studio/draft) handles it directly, including custom heights, ES-1-engineered assemblies, or unusual roof-edge conditions — or a project drawing submission for complex conditions.',
    keywords: ['gravel stop', 'roof edge metal', 'membrane roof edge', 'ES-1'],
  },
  {
    id: 'profile-fascia',
    category: 'AFS Profiles',
    subcategory: 'Roof Edge',
    topic: 'Fascia',
    content:
      'Fascia covers the exposed edge of a roof structure (rafter tails, deck edge, or a gravel stop\'s exterior face) for weather protection and a finished appearance. Used at roof edges on both sloped and low-slope roofs, and to conceal roof structure at overhangs. Typical configuration is a formed vertical face panel with a hemmed drip edge at the bottom and top/bottom cleat attachment; face height is limited by gauge and wind exposure. AFS fabricates fascia in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify face height, material, and gauge — FlashDraft (/studio/draft) handles it directly; taller faces or high-wind-zone engineering may need direct consultation with AFS.',
    keywords: ['fascia', 'roof fascia', 'fascia cover'],
  },
  {
    id: 'profile-gutter',
    category: 'AFS Profiles',
    subcategory: 'Drainage',
    topic: 'Gutter (K-style, half-round)',
    content:
      'Gutter collects roof runoff and channels it to downspouts. Used on virtually every building type. AFS fabricates K-style gutter (decorative ogee front profile, typically 5" and 6" widths — the standard residential/light-commercial choice) and half-round gutter (semicircular profile, common sizes typically 5", 6", and larger for commercial work — the traditional/high-end architectural choice, usually paired with round downspouts). Materials: copper, aluminum, galvanized steel, stainless, and Galvalume; box gutters (larger rectangular profiles for commercial/architectural work, sometimes built into the roof edge structure) are also fabricated but are more often custom-sized — see FlashDraft or drawing submission for box gutter work. To order: specify style (K-style or half-round), width, material, and gauge — FlashDraft (/studio/draft) handles standard K-style and half-round sizes directly, along with box gutters and unusual widths/profiles.',
    keywords: ['gutter', 'K-style gutter', 'half-round gutter', 'box gutter'],
  },
  {
    id: 'profile-downspout',
    category: 'AFS Profiles',
    subcategory: 'Drainage',
    topic: 'Downspout (rectangular vs. round)',
    content:
      'Downspout carries water from the gutter down the building face to grade or a drainage tie-in. Rectangular downspouts (smooth or corrugated face) are the common commercial choice, pairing with K-style or box gutters; round downspouts pair with half-round gutters, typically for residential and traditional/high-end architectural work. Used anywhere a gutter or roof drain needs to discharge to grade. AFS fabricates both profiles in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify profile (rectangular or round), cross-section dimension, length, material, and gauge — FlashDraft (/studio/draft) handles it directly, including custom lengths or offset/transition sections.',
    keywords: ['downspout', 'rectangular downspout', 'round downspout', 'leader'],
  },
  {
    id: 'profile-conductor-head',
    category: 'AFS Profiles',
    subcategory: 'Drainage',
    topic: 'Conductor Head',
    content:
      'Conductor head (also called leader head) is the funnel-shaped collector box at the top of a downspout, used where a roof drain, scupper, or box gutter outlet needs to transition into a smaller downspout, and often serves an overflow function as well as a decorative architectural element. Used on commercial and higher-end architectural buildings where downspout transitions need a formal collection point. Typical configuration is a tapered box with an inlet sized to the upstream drainage element and an outlet matched to the downspout below, sometimes with embossed or cast decorative detailing. AFS fabricates conductor heads in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: because conductor heads are inherently custom-geometry (inlet/outlet transition, decorative detailing), this profile is generally best handled through FlashDraft (/studio/draft) or a drawing/photo upload.',
    keywords: ['conductor head', 'leader head', 'downspout collector'],
  },
  {
    id: 'profile-scupper',
    category: 'AFS Profiles',
    subcategory: 'Drainage',
    topic: 'Scupper (through-wall vs. surface mount)',
    content:
      'Scupper is an opening through a parapet or wall that drains a low-slope roof at the perimeter, used as primary or secondary/overflow drainage. Through-wall scuppers are a sleeve or formed box passing entirely through the parapet to discharge outside the building line; surface-mount scuppers are fastened to the wall face at the opening rather than sleeved through it. Used on any low-slope roof needing perimeter drainage, and required on every low-slope roof as secondary/overflow drainage per code (typically set about 2" above the primary drainage line). AFS fabricates scuppers in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify through-wall or surface-mount type, opening dimensions, wall/parapet thickness (for through-wall), material, and gauge — given the wall-specific dimensions involved, scuppers are generally best designed through FlashDraft or a drawing submission.',
    keywords: ['scupper', 'through wall scupper', 'surface mount scupper', 'overflow scupper'],
  },
  {
    id: 'profile-reglet',
    category: 'AFS Profiles',
    subcategory: 'Wall/Roof Transition',
    topic: 'Reglet (surface mount vs. masonry cut)',
    content:
      'Reglet is a receiver profile, mounted to or cut into a wall substrate, that receives and secures the top edge of counter flashing. Surface-mount reglets are fastened to the wall face and sealed along the top edge — used where saw-cutting isn\'t practical or on new construction where the reglet is built into the wall assembly. Masonry-cut reglets are designed to be set into a sawn slot in existing masonry — common on retrofit and reroofing work where counter flashing needs to be added or replaced without disturbing the wall above. AFS fabricates reglets in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify surface-mount or masonry-cut style, length, material, and gauge — FlashDraft (/studio/draft) handles it directly; project-specific conditions are also well suited to a drawing submission.',
    keywords: ['reglet', 'surface mount reglet', 'masonry cut reglet', 'counter flashing reglet'],
  },
  {
    id: 'profile-z-bar-pitch-change',
    category: 'AFS Profiles',
    subcategory: 'Wall Panel Trim',
    topic: 'Z-Bar / Pitch Change',
    content:
      'Z-Bar (also called a pitch change) is a Z-shaped transition profile used where a wall panel, siding, or roofing plane changes pitch or steps to a different plane, providing a weathertight lap and structural transition between the two planes. Used extensively in wall panel and rainscreen assemblies at horizontal joints, and at roof pitch-change lines. Typical configuration is a formed Z profile sized to the substrate thickness and the required overlap on each leg. AFS fabricates Z-Bar in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify leg dimensions, material, and gauge — FlashDraft (/studio/draft) handles it directly, including project-specific transition conditions.',
    keywords: ['Z-bar', 'pitch change', 'wall panel transition', 'Z closure', 'z flashing'],
  },
  {
    id: 'profile-z-closure',
    category: 'AFS Profiles',
    subcategory: 'Wall Panel Trim',
    topic: 'Z-Closure',
    content:
      'Z-Closure is a formed Z-shaped trim piece used to close the open end condition of a corrugated or ribbed metal panel (roofing or wall panel), sealing the panel\'s corrugation profile against weather and pest intrusion at eaves, ridges, and terminations. Used anywhere a ribbed/corrugated panel run terminates against another plane or the building edge. AFS fabricates Z-closures in copper, aluminum, galvanized steel, stainless, and Galvalume, matched to the specific panel profile\'s rib spacing and depth. To order: specify the panel profile being closed (rib spacing/depth), material, and gauge — because closures must match a specific panel profile precisely, this item is typically configured through FlashDraft or with a sample/drawing of the panel profile in hand.',
    keywords: ['Z-closure', 'panel closure', 'rib closure', 'corrugated panel trim'],
  },
  {
    id: 'profile-hip-ridge-cap',
    category: 'AFS Profiles',
    subcategory: 'Roofing',
    topic: 'Hip Cap and Ridge Cap',
    content:
      'Hip cap covers the external angle where two roof slopes meet at a hip (as opposed to a valley\'s internal angle); ridge cap covers the horizontal peak where two roof slopes meet at the top of the roof. Both are used on sloped standing seam and other metal roofing systems to cover and weatherproof the panel terminations at these high-exposure lines. Typical configuration is a formed cap profile sized to the roof pitch angle (hip or ridge angle varies by roof design) with sufficient overlap onto the roofing panels on each side (commonly 4"–6" minimum) and closure strips to block the panel corrugation opening. AFS fabricates hip and ridge caps in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify the roof pitch/hip angle, cap width, material, and gauge — FlashDraft (/studio/draft) handles it directly, including unusual or irregular hip/ridge geometry.',
    keywords: ['hip cap', 'ridge cap', 'roof hip', 'roof ridge', 'standing seam ridge'],
  },
  {
    id: 'profile-inside-outside-corner',
    category: 'AFS Profiles',
    subcategory: 'Wall Panel Trim',
    topic: 'Inside Corner and Outside Corner',
    content:
      'Inside corner and outside corner trims cover and weatherproof wall panel or cladding corner conditions — inside corner where two wall planes meet at a concave (inward) angle, outside corner where they meet at a convex (outward) angle, most commonly at 90° but fabricated to other angles as needed. Used on any wall panel, rainscreen, or cladding system at building corners. Typical configuration is a formed angle profile sized to the panel thickness with legs long enough to properly lap and fasten to the adjacent panels on each face. AFS fabricates inside and outside corners in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify corner angle (90° standard, or custom), leg lengths, material, and gauge — FlashDraft (/studio/draft) handles it directly, whether it\'s a standard 90° corner or a non-90°/custom-leg corner.',
    keywords: ['inside corner', 'outside corner', 'wall panel corner', 'corner trim'],
  },
  {
    id: 'profile-window-door-pan',
    category: 'AFS Profiles',
    subcategory: 'Wall/Opening Flashing',
    topic: 'Window/Door Pan',
    content:
      'Window/door pan is a formed sloped tray installed beneath a window or door rough opening, sloped to drain outward with upturned end dams and a back dam, catching any water that bypasses the window/door unit and directing it back out before it reaches the rough framing. Used at every window and door opening, particularly in wall assemblies with siding, panel, or masonry cladding above grade. Typical configuration is a pan sized to the rough opening width plus enough leg extension to properly integrate with the jamb flashing and wall WRB on each side, with a slope built into the pan floor. AFS fabricates window/door pans in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify rough opening width and depth, end dam height, material, and gauge — because pan flashing must match a specific rough opening precisely, this is generally best handled through FlashDraft (/studio/draft) with exact opening dimensions in hand.',
    keywords: ['window pan', 'door pan', 'sill pan', 'pan flashing', 'rough opening flashing'],
  },
  {
    id: 'profile-expansion-joint-cover',
    category: 'AFS Profiles',
    subcategory: 'Movement Joints',
    topic: 'Expansion Joint Cover',
    content:
      'Expansion joint cover bridges a structural building movement joint (or a sheet metal thermal expansion joint in a long coping/gutter/fascia run) with a cover assembly designed to accommodate the anticipated movement without tearing or losing its seal. Used at building expansion joints in roofs, walls, and decks, and at intervals along long runs of coping, gutter, and fascia to relieve thermal movement stress. AFS fabricates several cover types — bellows-type (flexible, accordion-folded, for larger movement ranges), slide-plate (a cover that overlaps a fixed base and slides across it), and double-sided/center-split covers — in copper, aluminum, galvanized steel, stainless, and Galvalume. To order: specify joint width, anticipated total movement (if this is a structural building joint, this figure typically comes from the project engineer), cover type, material, and gauge — because expansion joint covers are movement-critical, custom-engineered items, they are best handled through FlashDraft or direct project consultation.',
    keywords: ['expansion joint cover', 'movement joint cover', 'bellows cover', 'slide plate cover'],
  },
  {
    id: 'profile-cleats',
    category: 'AFS Profiles',
    subcategory: 'Attachment/Fastening',
    topic: 'Cleat (flat, standing seam, double-lock, expansion, starter, cap)',
    content:
      'Cleats are the concealed attachment strips that secure sheet metal flashing, coping, gutters, and roofing panel edges to the substrate without face-fastening — the mechanism behind nearly every "concealed fastener" detail described elsewhere in this knowledge base. AFS fabricates several cleat types: flat cleats (a simple continuous strip hooked over a formed edge, the most common general-purpose cleat), standing seam cleats (formed to engage a standing seam panel\'s clip/seam profile at panel edges and terminations), double-lock cleats (engineered for the highest-wind-load double-lock standing seam systems), expansion cleats (designed to allow a small amount of controlled slip so the metal above can move thermally without tearing loose), starter cleats (the first cleat in a run, anchoring the starting edge of a panel or flashing run), and cap cleats (used specifically at coping/cap conditions, front and back, per the coping cap detailing described in the Division 7 knowledge base). Materials: copper, aluminum, galvanized steel, stainless, and Galvalume, matched to the metal they secure to avoid galvanic incompatibility. All cleats are custom geometry, sized to the specific profile and detail they serve — cleats are designed and ordered through FlashDraft (/studio/draft).',
    keywords: ['cleat', 'flat cleat', 'standing seam cleat', 'double lock cleat', 'expansion cleat', 'starter cleat', 'cap cleat', 'concealed fastener cleat'],
  },
  {
    id: 'profile-wall-panel-cladding',
    category: 'AFS Profiles',
    subcategory: 'Wall Panels',
    topic: 'Wall Panel / Cladding',
    content:
      'Wall panel/cladding covers building exterior walls as a rainscreen, reveal, or soffit panel system (see the Division 7 knowledge base for the technical detail on cavity ventilation, clip systems, and thermal bridging). Used on commercial and architectural buildings as a primary exterior finish or accent cladding. AFS fabricates wall panels in copper, aluminum (including Kynar 500/PVDF-coated and anodized finishes), galvanized steel, stainless, and Galvalume, in flat, reveal-jointed, and perforated/louvered (soffit) configurations. To order: because wall panel systems involve project-specific module sizing, joint patterns, and clip/attachment coordination, this profile category is handled through FlashDraft or a project drawing/consultation.',
    keywords: ['wall panel', 'cladding', 'rainscreen panel', 'reveal panel', 'soffit panel'],
  },
  {
    id: 'profile-custom-flashdraft',
    category: 'AFS Profiles',
    subcategory: 'Custom Geometry',
    topic: 'Custom Profile via FlashDraft',
    content:
      'Any profile that doesn\'t match one of AFS\'s standard configurations — an unusual bend sequence, a project-specific hybrid of two standard profiles, a cleat, or any shape a customer can sketch but not describe with a standard catalog name — can be drawn directly in FlashDraft (/studio/draft), AFS\'s browser-based profile design tool. The customer draws the cross-section leg by leg (with angle and dimension snapping available), FlashDraft computes the flat blank width, and the tool checks the drawn shape against AFS\'s library of 911 machine bend profiles for a match — an exact or close match means the profile can potentially run on AFS\'s existing Thalmann ZR150 CNC bending machine programs, speeding fabrication. FlashDraft supports hem details (Open, Smashed, Teardrop) at leg endpoints, a 2D/3D toggle to preview the profile as an extruded solid before submitting, and submission directly into the AFS quote request flow. This is the right tool whenever the customer describes something that isn\'t a clean match to a named standard profile, needs a cleat, or has a hand-sketched/mental image of a shape rather than a formal drawing.',
    keywords: ['custom profile', 'FlashDraft', 'custom bend', 'custom geometry', 'draw a profile'],
  },
];
