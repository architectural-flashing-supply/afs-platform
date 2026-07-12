-- 002_seed_afs_data.sql
-- AFS — Architectural Flashing Supply — Reference Data Seed
-- Seeds materials, gauges, and product_profiles so the quote wizard, configurator,
-- and product catalog have real dropdown data to render against.
-- Depends on: 001_initial_schema.sql
--
-- NOTE — DATA BLOCKERS (see CLAUDE.md "DATA BLOCKERS" table):
-- Pricing rules, commodity cost basis, and finish/color libraries are NOT seeded
-- here — that data has not been received from the client (checklist #12-23, #26).
-- This file seeds only architecturally-accurate reference data: material alloys,
-- gauge thicknesses/weights, and flashing profile geometry ranges.

-- ============================================================================
-- MATERIALS
-- ============================================================================
INSERT INTO materials (name, slug, alloy_grade, category, commodity_key, density_lbs_per_cubic_in, is_active, sort_order) VALUES
  ('Galvanized Steel',          'galvanized-steel',          'G90 Hot-Dip Galvanized',            'galvanized',    'steel_hrc',            0.283600, true, 10),
  ('Galvalume Steel',           'galvalume-steel',           'AZ50 Galvalume (55% Al-Zn)',        'galvalume',     'galvalume',            0.283600, true, 20),
  ('Copper',                    'copper',                    'C11000 Cold Rolled Sheet',          'copper',        'copper',               0.323000, true, 30),
  ('Lead Coated Copper',        'lead-coated-copper',        'Lead-Coated C11000',                'copper',        'copper',               0.323000, true, 40),
  ('Anodized Aluminum',         'anodized-aluminum',         '3003-H14 Class I Anodized',          'aluminum',      'aluminum',             0.097500, true, 50),
  ('Stainless Steel',           'stainless-steel',           'Type 304, #4 Brushed Finish',        'stainless',     'stainless_surcharge',  0.286400, true, 60),
  ('Zinc',                      'zinc',                      'Titanium Zinc (VMZINC-type)',        'zinc',          'zinc',                 0.257000, true, 70),
  ('Kynar 500 Painted Steel',   'kynar-500-painted-steel',   'Kynar 500 PVDF over G90 Substrate',  'painted_steel', 'steel_hrc',            0.283600, true, 80),
  ('Vintage Steel',             'vintage-steel',              'Weathered-Finish Coating over G90',  'painted_steel', 'steel_hrc',            0.283600, true, 90)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- GAUGES — thickness and weight per material
-- ============================================================================

-- Galvanized Steel
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '26 GA', 0.01790, 0.7310, true, 10 FROM materials WHERE slug = 'galvanized-steel'
UNION ALL SELECT id, '24 GA', 0.02390, 0.9760, true, 20 FROM materials WHERE slug = 'galvanized-steel'
UNION ALL SELECT id, '22 GA', 0.02960, 1.2094, true, 30 FROM materials WHERE slug = 'galvanized-steel'
UNION ALL SELECT id, '20 GA', 0.03590, 1.4661, true, 40 FROM materials WHERE slug = 'galvanized-steel';

-- Galvalume Steel
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '26 GA', 0.01790, 0.7310, true, 10 FROM materials WHERE slug = 'galvalume-steel'
UNION ALL SELECT id, '24 GA', 0.02390, 0.9760, true, 20 FROM materials WHERE slug = 'galvalume-steel'
UNION ALL SELECT id, '22 GA', 0.02960, 1.2094, true, 30 FROM materials WHERE slug = 'galvalume-steel';

-- Copper (by weight, standard roofing/flashing copper)
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '16 oz', 0.02160, 1.0047, true, 10 FROM materials WHERE slug = 'copper'
UNION ALL SELECT id, '20 oz', 0.02700, 1.2558, true, 20 FROM materials WHERE slug = 'copper'
UNION ALL SELECT id, '24 oz', 0.03240, 1.5070, true, 30 FROM materials WHERE slug = 'copper'
UNION ALL SELECT id, '32 oz', 0.04320, 2.0093, true, 40 FROM materials WHERE slug = 'copper';

-- Lead Coated Copper
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '16 oz LCC', 0.02160, 1.0047, true, 10 FROM materials WHERE slug = 'lead-coated-copper'
UNION ALL SELECT id, '20 oz LCC', 0.02700, 1.2558, true, 20 FROM materials WHERE slug = 'lead-coated-copper';

-- Anodized Aluminum
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '.032"', 0.03200, 0.4493, true, 10 FROM materials WHERE slug = 'anodized-aluminum'
UNION ALL SELECT id, '.040"', 0.04000, 0.5616, true, 20 FROM materials WHERE slug = 'anodized-aluminum'
UNION ALL SELECT id, '.050"', 0.05000, 0.7020, true, 30 FROM materials WHERE slug = 'anodized-aluminum'
UNION ALL SELECT id, '.063"', 0.06300, 0.8845, true, 40 FROM materials WHERE slug = 'anodized-aluminum';

-- Stainless Steel
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '26 GA', 0.01870, 0.7712, true, 10 FROM materials WHERE slug = 'stainless-steel'
UNION ALL SELECT id, '24 GA', 0.02500, 1.0310, true, 20 FROM materials WHERE slug = 'stainless-steel'
UNION ALL SELECT id, '22 GA', 0.03120, 1.2867, true, 30 FROM materials WHERE slug = 'stainless-steel';

-- Zinc
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '0.7mm', 0.02760, 1.0214, true, 10 FROM materials WHERE slug = 'zinc'
UNION ALL SELECT id, '0.8mm', 0.03150, 1.1658, true, 20 FROM materials WHERE slug = 'zinc'
UNION ALL SELECT id, '1.0mm', 0.03940, 1.4581, true, 30 FROM materials WHERE slug = 'zinc';

-- Kynar 500 Painted Steel
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '26 GA', 0.01790, 0.7310, true, 10 FROM materials WHERE slug = 'kynar-500-painted-steel'
UNION ALL SELECT id, '24 GA', 0.02390, 0.9760, true, 20 FROM materials WHERE slug = 'kynar-500-painted-steel';

-- Vintage Steel
INSERT INTO gauges (material_id, label, thickness_inches, weight_lbs_sqft, is_active, sort_order)
SELECT id, '26 GA', 0.01790, 0.7310, true, 10 FROM materials WHERE slug = 'vintage-steel'
UNION ALL SELECT id, '24 GA', 0.02390, 0.9760, true, 20 FROM materials WHERE slug = 'vintage-steel';

-- ============================================================================
-- PRODUCT PROFILES
-- ============================================================================
INSERT INTO product_profiles
  (name, slug, category, description,
   min_width, max_width, min_height, max_height,
   min_leg_a, max_leg_a, min_leg_b, max_leg_b,
   standard_length_ft, max_length_ft, requires_consultation, is_active, sort_order)
VALUES
  ('Coping Cap', 'coping-cap', 'coping',
   'Parapet wall coping cap with mitered corners, cleated hem, and continuous cover joints. Fabricated to wall width with drip legs on both sides.',
   6, 36, 4, 16, 2, 8, 2, 8, 10, 12, false, true, 10),

  ('Base Flashing', 'base-flashing', 'base-flashing',
   'Roof-to-wall transition flashing set beneath counter flashing, fabricated to wall and roof pitch geometry.',
   4, 24, 4, 24, 2, 6, 2, 6, 10, 12, false, true, 20),

  ('Counter Flashing', 'counter-flashing', 'counter-flashing',
   'Reglet-set counter flashing that laps over base flashing to complete a two-piece roof-to-wall termination.',
   3, 12, 2, 8, 1, 4, NULL, NULL, 10, 12, false, true, 30),

  ('Drip Edge', 'drip-edge', 'drip-edge',
   'Eave and rake edge metal providing a controlled drip line and wind-driven rain protection at roof perimeters.',
   2, 8, 1, 4, 0.5, 2, NULL, NULL, 10, 12, false, true, 40),

  ('Gravel Stop', 'gravel-stop', 'gravel-stop',
   'Low-slope roof edge metal with a formed face and fascia return, used to retain ballast and terminate membrane roofing.',
   4, 12, 2, 6, 1, 4, NULL, NULL, 10, 12, false, true, 50),

  ('Fascia', 'fascia', 'fascia',
   'Formed fascia cover metal for roof edges and soffit transitions, fabricated to specified face height.',
   6, 24, 4, 12, NULL, NULL, NULL, NULL, 10, 12, false, true, 60),

  ('Scupper', 'scupper', 'scupper',
   'Through-wall drainage scupper box fabricated to opening size and wall thickness. Engineering review required for flow sizing.',
   4, 24, 4, 24, 2, 12, 2, 12, NULL, NULL, true, true, 70),

  ('Valley Flashing', 'valley-flashing', 'valley-flashing',
   'Open valley flashing with a formed center rib to divide water flow between intersecting roof planes.',
   12, 24, NULL, NULL, 6, 12, NULL, NULL, 10, 12, false, true, 80),

  ('Expansion Joint', 'expansion-joint', 'expansion-joint',
   'Movement joint cover fabricated with an internal expansion bellows to accommodate structural building movement. Engineering review required.',
   4, 18, 2, 8, NULL, NULL, NULL, NULL, 10, 20, true, true, 90),

  ('Window & Door Flashing', 'window-door-flashing', 'window-door-flashing',
   'Head, sill, and jamb flashing fabricated to opening dimensions for window and door weatherproofing.',
   2, 12, 2, 8, 1, 4, NULL, NULL, 10, 12, false, true, 100),

  ('Standing Seam Roofing', 'standing-seam-roofing', 'standing-seam',
   'Field- or shop-formed standing seam roof panel system. Panel width, seam type, and clip spacing require engineering review.',
   12, 24, NULL, NULL, NULL, NULL, NULL, NULL, 20, 40, true, true, 110),

  ('Custom Profile', 'custom-profile', 'custom',
   'Fully custom flashing profile outside standard geometry ranges. Requires AFS engineering consultation before fabrication.',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, true, 120)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- END 002_seed_afs_data.sql
-- ============================================================================
