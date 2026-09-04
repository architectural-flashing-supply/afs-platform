// HailView shared types — app/hailview, app/api/hailview/**, lib/hailview/**.

export type MaterialCategory =
  | 'asphalt_shingle'
  | 'metal_r_panel'
  | 'metal_standing_seam'
  | 'tpo_pvc_membrane'
  | 'wood_shake';

export type ReplacementTier = 'Low' | 'Moderate' | 'High';

export type MetalGauge = '29ga' | '26ga' | '24ga' | '22ga';
export type MembraneMilThickness = 45 | 60 | 80;

export interface StormEvent {
  id: string;
  isHail: boolean;
  typeText: string;
  sizeIn: number | null; // hail diameter in inches — null for non-hail reports
  magnitude: number | null;
  unit: string | null;
  validAt: string; // ISO 8601
  city: string | null;
  county: string | null;
  state: string | null;
  distanceMi: number;
  lat: number;
  lon: number;
  remark: string | null;
}
