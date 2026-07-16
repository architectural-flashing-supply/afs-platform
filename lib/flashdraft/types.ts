// FlashDraft state-machine types. Geometry lives entirely in inches
// ("Geo" space); CanvasPoint is screen-pixel space. See geometry.ts for the
// conversion functions between the two.
//
// materialId / gaugeId store the catalog string identifiers from
// lib/data/catalog.ts (e.g. "Copper", "24 ga") — NOT database UUIDs.
// saved_configurations.material_id/gauge_id are real FK columns into the
// materials/gauges tables (see SCHEMA.md), but that catalog data hasn't
// been delivered yet (CLAUDE.md Data Blockers), and the whole rest of the
// site drives its material/gauge pickers off this same static catalog —
// so, matching the FK columns' pre-existing null-on-save behavior, these
// values are persisted inside the `dimensions` JSONB blob instead.

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface GeoPoint {
  x: number;
  y: number;
}

export type HemType = 'open' | 'smashed' | 'teardrop';

export interface Hem {
  id: string;
  legId: string;
  distanceFromStartIn: number;
  lengthIn: number;
  type: HemType;
  gapIn: number;
}

export interface Leg {
  id: string;
  startGeo: GeoPoint;
  endGeo: GeoPoint;
  lengthIn: number;
  angleRad: number;
  hems: Hem[];
}

export interface BendPoint {
  id: string;
  geo: GeoPoint;
  angleDegrees: number;
  radiusIn: number;
  incomingLegId: string;
  outgoingLegId: string;
}

export interface ProfileGeometry {
  legs: Leg[];
  bendPoints: BendPoint[];
  hems: Hem[];
}

export interface ProfileState {
  geometry: ProfileGeometry;
  name: string;
  revision: number;
  savedProfileId: string | null;
  materialId: string | null;
  gaugeId: string | null;
  lengthFt: number;
  lengthInExtra: number;
  quantity: number;
  notes: string;
  blankWidthIn: number;
  bendCount: number;
  hemCount: number;
  paintFace: 'up' | 'down' | null;
}

export type InteractionState =
  | { type: 'IDLE' }
  | { type: 'DRAWING'; startGeo: GeoPoint; previewGeo: GeoPoint | null }
  | { type: 'SELECTED_LEG'; legId: string }
  | { type: 'SELECTED_BEND'; bendPointId: string }
  | { type: 'SELECTED_HEM'; hemId: string }
  | { type: 'DRAGGING_BEND'; bendPointId: string; originalGeo: GeoPoint }
  | { type: 'DRAGGING_HEM_ENDPOINT'; hemId: string; originalLengthIn: number }
  | { type: 'DRAWING_HEM'; legId: string; startTParam: number; previewLengthIn: number }
  | { type: 'PANNING'; lastPixel: CanvasPoint };

export interface CanvasTransform {
  scale: number;
  panOffsetX: number;
  panOffsetY: number;
}

export type ActiveView = '2d' | '3d';

export interface HemPopupState {
  visible: boolean;
  hemId: string | null;
}

export type FlashDraftAction =
  | { type: 'POINTER_DOWN'; pixel: CanvasPoint; buttons: number; spaceDown: boolean }
  | { type: 'POINTER_MOVE'; pixel: CanvasPoint }
  | { type: 'POINTER_UP'; pixel: CanvasPoint }
  | { type: 'POINTER_LEAVE' }
  | { type: 'DOUBLE_CLICK'; pixel: CanvasPoint }
  | { type: 'WHEEL'; pixel: CanvasPoint; deltaY: number }
  | { type: 'KEY_DOWN'; key: string; ctrl: boolean }
  | { type: 'SET_LEG_LENGTH'; legId: string; lengthIn: number }
  | { type: 'SET_BEND_ANGLE'; bendPointId: string; angleDegrees: number }
  | { type: 'SET_BEND_RADIUS'; bendPointId: string; radiusIn: number }
  | { type: 'SET_HEM_TYPE'; hemId: string; hemType: HemType }
  | { type: 'SET_HEM_LENGTH'; hemId: string; lengthIn: number }
  | { type: 'SET_HEM_GAP'; hemId: string; gapIn: number }
  | { type: 'DELETE_SELECTED' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR' }
  | { type: 'ROTATE_LEFT' }
  | { type: 'ROTATE_RIGHT' }
  | { type: 'FIT_TO_SCREEN'; canvasWidth: number; canvasHeight: number }
  | { type: 'SET_PAN'; panOffsetX: number; panOffsetY: number }
  | { type: 'SET_ZOOM'; scale: number; pixel: CanvasPoint }
  | { type: 'SELECT_ADJACENT_BEND'; direction: 1 | -1 }
  | { type: 'SET_MATERIAL'; materialId: string }
  | { type: 'SET_GAUGE'; gaugeId: string }
  | { type: 'SET_LENGTH_FT'; ft: number }
  | { type: 'SET_LENGTH_IN'; inches: number }
  | { type: 'SET_QUANTITY'; quantity: number }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'SET_PROFILE_NAME'; name: string }
  | { type: 'SET_PAINT_FACE'; face: 'up' | 'down' }
  | { type: 'LOAD_PROFILE'; profile: ProfileState }
  | { type: 'MARK_SAVED'; profileId: string; name: string }
  | { type: 'CLOSE_HEM_POPUP' }
  | { type: 'SELECT_HEM_TYPE_FROM_POPUP'; hemId: string; hemType: HemType }
  | { type: 'SET_ACTIVE_VIEW'; view: ActiveView };

export interface FlashDraftState {
  profile: ProfileState;
  interaction: InteractionState;
  transform: CanvasTransform;
  activeView: ActiveView;
  hemPopup: HemPopupState;
  history: ProfileState[];
  future: ProfileState[];
  isDirty: boolean;
}

export interface QuoteSubmissionProfile {
  profileName: string;
  blankWidthIn: number;
  totalLengthFt: number;
  totalLengthInExtra: number;
  quantity: number;
  materialId: string;
  gaugeId: string;
  notes: string;
  paintFace: 'up' | 'down' | null;
  legs: Array<{
    lengthIn: number;
    hems: Array<{
      type: HemType;
      lengthIn: number;
      gapIn: number;
      distanceFromStartIn: number;
    }>;
  }>;
  bendPoints: Array<{
    angleDegrees: number;
    radiusIn: number;
  }>;
}

export interface HitResult {
  type: 'bend' | 'hem_endpoint' | 'leg' | 'none';
  id?: string;
  hemId?: string;
  endpoint?: 'start' | 'end';
  tParam?: number;
}
