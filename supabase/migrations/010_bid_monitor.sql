-- ============================================================================
-- 010_bid_monitor.sql
-- Bid Monitor — government/commercial procurement bid tracking
--
-- Filename note: this was requested as 008_bid_monitor.sql, but 008 and 009
-- are already real, applied-looking migrations on disk
-- (008_order_geocoding.sql, 009_command_center_crm.sql — both postdate
-- 005_machine_jobs.sql, the newest migration referenced in the governance
-- context this task was given). Numbered 010 instead of colliding with or
-- overwriting either. SCHEMA.md is updated to match.
--
-- Four tables, admin-only end to end (this is an internal AFS sales-ops
-- tool, never customer-facing, so every RLS policy is the standard
-- admin_all_* FOR ALL pattern used throughout this schema):
--   bid_sources   — the procurement portals being monitored (federal/state/
--                   city/county/DOT/plan-room/exchange)
--   bid_projects  — individual bid opportunities discovered from a source
--   bid_keywords  — the Division-7/flashing keyword list used to flag
--                   relevant projects and (via match_count) tune the list
--   bid_alerts    — notification log when a project matches / is due soon /
--                   changes status
--
-- CHECK constraints added on every enum-like text column (source_type,
-- project_type, status, category, alert_type) — not explicitly requested,
-- but matches this schema's established convention (every status/type
-- column elsewhere in 001-009 has one) and costs nothing at seed time since
-- every seeded value already falls inside its own enum.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: bid_sources
-- ----------------------------------------------------------------------------

CREATE TABLE bid_sources (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  source_type             TEXT NOT NULL
                          CHECK (source_type IN (
                            'federal','state','city','county','dot','planroom','exchange'
                          )),
  state                   TEXT,
  url                     TEXT NOT NULL,
  api_url                 TEXT,
  api_key_env             TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  is_free                 BOOLEAN NOT NULL DEFAULT true,
  requires_membership     BOOLEAN NOT NULL DEFAULT false,
  membership_cost_annual  INTEGER,
  notes                   TEXT,
  last_checked_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_sources_type ON bid_sources(source_type);
CREATE INDEX idx_bid_sources_state ON bid_sources(state);
CREATE INDEX idx_bid_sources_active ON bid_sources(is_active);

ALTER TABLE bid_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_bid_sources" ON bid_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- TABLE: bid_projects
-- ----------------------------------------------------------------------------

CREATE TABLE bid_projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           UUID REFERENCES bid_sources(id),
  external_id         TEXT,
  title               TEXT NOT NULL,
  description         TEXT,
  agency              TEXT,
  location_city       TEXT,
  location_state      TEXT,
  location_address    TEXT,
  bid_due_date        TIMESTAMPTZ,
  pre_bid_date        TIMESTAMPTZ,
  estimated_value     BIGINT,
  project_type        TEXT
                      CHECK (project_type IN (
                        'roofing','flashing','sheet_metal','general_construction','other'
                      )),
  division7_relevant  BOOLEAN NOT NULL DEFAULT false,
  keywords_matched    TEXT[],
  source_url          TEXT,
  raw_data            JSONB,
  status              TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN (
                        'new','reviewing','bidding','bid_submitted',
                        'won','lost','passed','expired'
                      )),
  assigned_to         UUID REFERENCES profiles(id),
  internal_notes      TEXT,
  discovered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bid_submitted_at    TIMESTAMPTZ,
  result_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX idx_bid_projects_source ON bid_projects(source_id);
CREATE INDEX idx_bid_projects_status ON bid_projects(status);
CREATE INDEX idx_bid_projects_due_date ON bid_projects(bid_due_date);
CREATE INDEX idx_bid_projects_division7 ON bid_projects(division7_relevant);
CREATE INDEX idx_bid_projects_assigned ON bid_projects(assigned_to);
CREATE INDEX idx_bid_projects_discovered ON bid_projects(discovered_at DESC);

ALTER TABLE bid_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_bid_projects" ON bid_projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- TABLE: bid_keywords
-- ----------------------------------------------------------------------------

CREATE TABLE bid_keywords (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword      TEXT NOT NULL UNIQUE,
  category     TEXT CHECK (category IN ('profile','material','division','trade')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  match_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_bid_keywords_active ON bid_keywords(is_active);

ALTER TABLE bid_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_bid_keywords" ON bid_keywords
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- TABLE: bid_alerts
-- ----------------------------------------------------------------------------

CREATE TABLE bid_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES bid_projects(id),
  alert_type  TEXT CHECK (alert_type IN ('new_match','bid_due_soon','status_change')),
  sent_to     TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX idx_bid_alerts_project ON bid_alerts(project_id);

ALTER TABLE bid_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_bid_alerts" ON bid_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- SEED: bid_keywords (30 rows)
-- ----------------------------------------------------------------------------

INSERT INTO bid_keywords (keyword, category) VALUES
  ('flashing', 'trade'),
  ('sheet metal', 'trade'),
  ('architectural metal', 'trade'),
  ('coping cap', 'profile'),
  ('gravel stop', 'profile'),
  ('drip edge', 'profile'),
  ('gutter', 'profile'),
  ('downspout', 'profile'),
  ('fascia', 'profile'),
  ('counter flashing', 'profile'),
  ('base flashing', 'profile'),
  ('step flashing', 'profile'),
  ('valley flashing', 'profile'),
  ('reglet', 'profile'),
  ('scupper', 'profile'),
  ('expansion joint', 'profile'),
  ('conductor head', 'profile'),
  ('Z-bar', 'profile'),
  ('standing seam', 'profile'),
  ('metal roofing', 'trade'),
  ('roof specialties', 'trade'),
  ('Division 07', 'division'),
  ('07 62 00', 'division'),
  ('07 71 00', 'division'),
  ('SMACNA', 'division'),
  ('thermal and moisture', 'division'),
  ('copper flashing', 'material'),
  ('aluminum flashing', 'material'),
  ('galvanized', 'material'),
  ('stainless flashing', 'material');

-- ----------------------------------------------------------------------------
-- SEED: bid_sources (81 rows)
--
-- Column-mapping note: the source spec for this seed gave 10 positional
-- values per row (name, source_type, state, url, api_url, api_key_env,
-- is_active, <bool>, membership_cost_annual, notes) with that 8th value
-- always `false` and membership_cost_annual always `null` — including on
-- rows whose own notes say "Free for subcontractors" / "Free public
-- API available". Read literally as is_free that would make every source
-- non-free, contradicting every single note. Read instead as
-- requires_membership (also always false/null here, and consistent with
-- every note), it's self-consistent, so that's the mapping used below —
-- is_free is left at its schema default (true) for all 81 rows.
-- ----------------------------------------------------------------------------

INSERT INTO bid_sources (name, source_type, state, url, api_url, api_key_env, is_active, requires_membership, membership_cost_annual, notes) VALUES
  -- FEDERAL
  ('SAM.gov', 'federal', null, 'https://sam.gov/opportunities', 'https://api.sam.gov/opportunities/v2/search', 'SAM_GOV_API_KEY', true, false, null, 'Federal procurement — full public API available. Requires free API key from api.data.gov'),
  ('USASpending.gov', 'federal', null, 'https://usaspending.gov', 'https://api.usaspending.gov/api/v2/search/spending_by_award/', null, true, false, null, 'Federal awards data. No API key required.'),

  -- TEXAS STATE
  ('Texas ESBD', 'state', 'TX', 'https://www.txsmartbuy.gov/esbd', 'https://www.txsmartbuy.gov/esbd', null, true, false, null, 'Texas Electronic State Business Daily — official state procurement portal'),
  ('TxDOT Letting Calendar', 'dot', 'TX', 'https://www.txdot.gov/business/contractors/highway-letting.html', null, null, true, false, null, 'Texas DOT highway construction lettings'),

  -- TEXAS CITIES
  ('City of Austin Purchasing', 'city', 'TX', 'https://www.austintexas.gov/department/purchasing', null, null, true, false, null, 'City of Austin procurement portal'),
  ('City of San Antonio Purchasing', 'city', 'TX', 'https://www.sanantonio.gov/Finance/Purchasing', null, null, true, false, null, 'San Antonio city procurement'),
  ('City of Houston Purchasing', 'city', 'TX', 'https://purchasing.houstontx.gov', null, null, true, false, null, 'Houston city procurement portal'),
  ('City of Dallas Purchasing', 'city', 'TX', 'https://dallascityhall.com/departments/procurement', null, null, true, false, null, 'Dallas city procurement'),
  ('City of Fort Worth Purchasing', 'city', 'TX', 'https://www.fortworthtexas.gov/departments/finance/purchasing', null, null, true, false, null, 'Fort Worth city procurement'),
  ('City of Arlington Purchasing', 'city', 'TX', 'https://www.arlingtontx.gov/city_hall/departments/purchasing', null, null, true, false, null, 'Arlington TX city procurement'),
  ('City of Lubbock Purchasing', 'city', 'TX', 'https://ci.lubbock.tx.us/departments/purchasing', null, null, true, false, null, 'Lubbock city procurement'),
  ('City of Amarillo Purchasing', 'city', 'TX', 'https://www.amarillo.gov/departments/city-manager-s-office/purchasing', null, null, true, false, null, 'Amarillo city procurement'),
  ('City of Waco Purchasing', 'city', 'TX', 'https://www.waco-texas.com/cms/departments/purchasing', null, null, true, false, null, 'Waco city procurement'),
  ('City of Midland Purchasing', 'city', 'TX', 'https://www.midlandtexas.gov/government/departments/purchasing', null, null, true, false, null, 'Midland TX city procurement'),
  ('City of Odessa Purchasing', 'city', 'TX', 'https://www.odessa-tx.gov/government/departments/purchasing', null, null, true, false, null, 'Odessa TX city procurement'),
  ('Burnet County', 'county', 'TX', 'https://www.burnetcounty.org', null, null, true, false, null, 'Local — AFS home county'),
  ('Travis County Purchasing', 'county', 'TX', 'https://www.traviscountytx.gov/purchasing', null, null, true, false, null, 'Travis County TX procurement'),
  ('Bexar County Purchasing', 'county', 'TX', 'https://www.bexar.org/2004/Purchasing', null, null, true, false, null, 'Bexar County TX procurement'),
  ('Harris County Purchasing', 'county', 'TX', 'https://www.harriscountytx.gov/Procurement', null, null, true, false, null, 'Harris County TX procurement'),

  -- ALL 50 STATE PROCUREMENT PORTALS (Texas already covered above)
  ('Alabama Procurement', 'state', 'AL', 'https://purchasing.alabama.gov', null, null, true, false, null, 'Alabama state procurement'),
  ('Alaska Procurement', 'state', 'AK', 'https://aws.state.ak.us/online/Bids.aspx', null, null, true, false, null, 'Alaska state procurement'),
  ('Arizona Procurement', 'state', 'AZ', 'https://spo.az.gov', null, null, true, false, null, 'Arizona state procurement'),
  ('Arkansas Procurement', 'state', 'AR', 'https://www.dfa.arkansas.gov/offices/procurement', null, null, true, false, null, 'Arkansas state procurement'),
  ('California Procurement', 'state', 'CA', 'https://caleprocure.ca.gov', null, null, true, false, null, 'California state procurement'),
  ('Colorado Procurement', 'state', 'CO', 'https://www.colorado.gov/pacific/oit/bids', null, null, true, false, null, 'Colorado state procurement'),
  ('Connecticut Procurement', 'state', 'CT', 'https://portal.ct.gov/DAS/CTSource/CTSource', null, null, true, false, null, 'Connecticut state procurement'),
  ('Delaware Procurement', 'state', 'DE', 'https://mmp.delaware.gov', null, null, true, false, null, 'Delaware state procurement'),
  ('Florida Procurement', 'state', 'FL', 'https://vendor.myflorida.com', null, null, true, false, null, 'Florida state procurement'),
  ('Georgia Procurement', 'state', 'GA', 'https://doas.ga.gov/state-purchasing', null, null, true, false, null, 'Georgia state procurement'),
  ('Hawaii Procurement', 'state', 'HI', 'https://hands.ehawaii.gov/hands/opportunities', null, null, true, false, null, 'Hawaii state procurement'),
  ('Idaho Procurement', 'state', 'ID', 'https://purchasing.idaho.gov', null, null, true, false, null, 'Idaho state procurement'),
  ('Illinois Procurement', 'state', 'IL', 'https://www2.illinois.gov/cms/business/sell2/Pages/default.aspx', null, null, true, false, null, 'Illinois state procurement'),
  ('Indiana Procurement', 'state', 'IN', 'https://www.in.gov/idoa/procurement', null, null, true, false, null, 'Indiana state procurement'),
  ('Iowa Procurement', 'state', 'IA', 'https://bidopportunities.iowa.gov', null, null, true, false, null, 'Iowa state procurement'),
  ('Kansas Procurement', 'state', 'KS', 'https://supplier.sok.ks.gov', null, null, true, false, null, 'Kansas state procurement'),
  ('Kentucky Procurement', 'state', 'KY', 'https://eProcurement.ky.gov', null, null, true, false, null, 'Kentucky state procurement'),
  ('Louisiana Procurement', 'state', 'LA', 'https://wwwcfprd.doa.louisiana.gov/osp/lapac/pubMain.cfm', null, null, true, false, null, 'Louisiana state procurement'),
  ('Maine Procurement', 'state', 'ME', 'https://www.maine.gov/dafs/bbm/procurementservices', null, null, true, false, null, 'Maine state procurement'),
  ('Maryland Procurement', 'state', 'MD', 'https://emaryland.buyspeed.com/bso', null, null, true, false, null, 'Maryland state procurement'),
  ('Massachusetts Procurement', 'state', 'MA', 'https://www.commbuys.com', null, null, true, false, null, 'Massachusetts state procurement'),
  ('Michigan Procurement', 'state', 'MI', 'https://sigma.michigan.gov/webapp/PRDVSS2X1/AltSelfService', null, null, true, false, null, 'Michigan state procurement'),
  ('Minnesota Procurement', 'state', 'MN', 'https://mn.gov/admin/supplier', null, null, true, false, null, 'Minnesota state procurement'),
  ('Mississippi Procurement', 'state', 'MS', 'https://www.dfa.ms.gov/dfa-offices/purchasing-travel-and-fleet-management/purchasing', null, null, true, false, null, 'Mississippi state procurement'),
  ('Missouri Procurement', 'state', 'MO', 'https://oa.mo.gov/purchasing', null, null, true, false, null, 'Missouri state procurement'),
  ('Montana Procurement', 'state', 'MT', 'https://vendor.mt.gov', null, null, true, false, null, 'Montana state procurement'),
  ('Nebraska Procurement', 'state', 'NE', 'https://das.nebraska.gov/materiel/purchasing.html', null, null, true, false, null, 'Nebraska state procurement'),
  ('Nevada Procurement', 'state', 'NV', 'https://purchasing.nv.gov', null, null, true, false, null, 'Nevada state procurement'),
  ('New Hampshire Procurement', 'state', 'NH', 'https://das.nh.gov/purchasing', null, null, true, false, null, 'New Hampshire state procurement'),
  ('New Jersey Procurement', 'state', 'NJ', 'https://www.njstart.gov', null, null, true, false, null, 'New Jersey state procurement'),
  ('New Mexico Procurement', 'state', 'NM', 'https://www.generalservices.state.nm.us/state-purchasing', null, null, true, false, null, 'New Mexico state procurement'),
  ('New York Procurement', 'state', 'NY', 'https://www.ogs.ny.gov/procurement', null, null, true, false, null, 'New York state procurement'),
  ('North Carolina Procurement', 'state', 'NC', 'https://vendor.ncgov.com', null, null, true, false, null, 'North Carolina state procurement'),
  ('North Dakota Procurement', 'state', 'ND', 'https://www.nd.gov/omb/public/vendor-information/procurement-bids', null, null, true, false, null, 'North Dakota state procurement'),
  ('Ohio Procurement', 'state', 'OH', 'https://procure.ohio.gov', null, null, true, false, null, 'Ohio state procurement'),
  ('Oklahoma Procurement', 'state', 'OK', 'https://www.ok.gov/dcs/solicit', null, null, true, false, null, 'Oklahoma state procurement'),
  ('Oregon Procurement', 'state', 'OR', 'https://orpin.oregon.gov', null, null, true, false, null, 'Oregon state procurement'),
  ('Pennsylvania Procurement', 'state', 'PA', 'https://www.emarketplace.state.pa.us', null, null, true, false, null, 'Pennsylvania state procurement'),
  ('Rhode Island Procurement', 'state', 'RI', 'https://www.ridop.ri.gov', null, null, true, false, null, 'Rhode Island state procurement'),
  ('South Carolina Procurement', 'state', 'SC', 'https://vendor.procurement.sc.gov', null, null, true, false, null, 'South Carolina state procurement'),
  ('South Dakota Procurement', 'state', 'SD', 'https://bids.sd.gov', null, null, true, false, null, 'South Dakota state procurement'),
  ('Tennessee Procurement', 'state', 'TN', 'https://www.tn.gov/generalservices/procurement', null, null, true, false, null, 'Tennessee state procurement'),
  ('Utah Procurement', 'state', 'UT', 'https://purchasing.utah.gov', null, null, true, false, null, 'Utah state procurement'),
  ('Vermont Procurement', 'state', 'VT', 'https://bid.vermont.gov', null, null, true, false, null, 'Vermont state procurement'),
  ('Virginia Procurement', 'state', 'VA', 'https://eva.virginia.gov', null, null, true, false, null, 'Virginia eVA procurement portal'),
  ('Washington Procurement', 'state', 'WA', 'https://fortress.wa.gov/ga/apps/bidder/default.aspx', null, null, true, false, null, 'Washington state procurement'),
  ('West Virginia Procurement', 'state', 'WV', 'https://www.wvpurchasing.gov', null, null, true, false, null, 'West Virginia state procurement'),
  ('Wisconsin Procurement', 'state', 'WI', 'https://vendornet.wi.gov', null, null, true, false, null, 'Wisconsin state procurement'),
  ('Wyoming Procurement', 'state', 'WY', 'https://ai.wyo.gov/divisions/gsd/procurement', null, null, true, false, null, 'Wyoming state procurement'),

  -- FREE PLAN ROOMS / BID BOARDS
  ('PlanHub', 'planroom', null, 'https://www.planhub.com', null, 'PLANHUB_API_KEY', true, false, null, 'Free for subcontractors. Register at planhub.com. API key required for integration.'),
  ('BidPlanroom', 'planroom', null, 'https://www.bidplanroom.com', null, null, true, false, null, 'Free public project listings. No API — web monitoring required.'),
  ('ConstructConnect Free Tier', 'planroom', null, 'https://www.constructconnect.com', null, null, true, false, null, 'Free bid invitation tier for subcontractors.'),

  -- STATE DOT PORTALS
  ('TxDOT', 'dot', 'TX', 'https://www.txdot.gov/business/contractors/highway-letting.html', null, null, true, false, null, 'Texas DOT lettings'),
  ('ALDOT', 'dot', 'AL', 'https://www.dot.state.al.us/bureaus/contracts/ContractsHome.aspx', null, null, true, false, null, 'Alabama DOT'),
  ('FDOT', 'dot', 'FL', 'https://www.fdot.gov/procurement/bidslist.shtm', null, null, true, false, null, 'Florida DOT'),
  ('GDOT', 'dot', 'GA', 'https://www.dot.ga.gov/PartnerSmart/Business/Pages/Letting.aspx', null, null, true, false, null, 'Georgia DOT'),
  ('CDOT', 'dot', 'CO', 'https://www.codot.gov/business/bidding', null, null, true, false, null, 'Colorado DOT'),
  ('NCDOT', 'dot', 'NC', 'https://connect.ncdot.gov/letting/Pages/default.aspx', null, null, true, false, null, 'North Carolina DOT'),
  ('ODOT', 'dot', 'OK', 'https://www.odot.org/business/bid-lettings', null, null, true, false, null, 'Oklahoma DOT'),
  ('NMDOT', 'dot', 'NM', 'https://dot.nm.gov/content/dot/en/public/business-with-nmdot/bid-letting.html', null, null, true, false, null, 'New Mexico DOT'),
  ('AzDOT', 'dot', 'AZ', 'https://bids.azdot.gov', null, null, true, false, null, 'Arizona DOT'),
  ('LADOTD', 'dot', 'LA', 'https://www.dotd.la.gov/inside_LaDOTD/Divisions/Engineering/Contracts/Pages/default.aspx', null, null, true, false, null, 'Louisiana DOT');

-- ============================================================================
-- End 010_bid_monitor.sql
-- ============================================================================
