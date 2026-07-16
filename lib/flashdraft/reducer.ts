import { computeBlankWidth, gaugeThicknessInFromCatalog } from './blankWidth';
import {
  canvasToGeo,
  centroidOfGeometry,
  computeProfileStats,
  dragBendPoint,
  geoDistance,
  geoToCanvas,
  hitTest,
  lineAngleRad,
  pixelDistance,
  pointAlongLeg,
  rotatePoint,
  signedAngleBetween,
  snapAngle,
  snapLength,
} from './geometry';
import type {
  BendPoint,
  FlashDraftAction,
  FlashDraftState,
  GeoPoint,
  Hem,
  Leg,
  ProfileGeometry,
  ProfileState,
} from './types';

const HIT_RADIUS_PX = 12;
const MIN_DRAG_SEGMENT_IN = 0.125;
const MIN_BEND_RADIUS_IN = 0.125;
const MAX_BEND_RADIUS_IN = 4;
const MIN_SCALE = 4;
const MAX_SCALE = 400;
const HISTORY_LIMIT = 50;
const ZOOM_STEP_RATIO = 0.001;
const FIT_MARGIN_FACTOR = 1.2;

function newId(): string {
  return crypto.randomUUID();
}

function defaultBendRadiusIn(materialId: string | null): number {
  if (!materialId) return 0.5;
  if (/copper|zinc/i.test(materialId)) return 0.75;
  if (/aluminu?m/i.test(materialId)) return 0.375;
  return 0.5;
}

// Default air-gap for a new hem, matching a real 3/16" open hem — also the
// gapIn value teardrop/smashed hems overwrite when their type is selected.
const HEM_DEFAULT_GAP_IN = 0.1875;

function recomputeProfile(profile: ProfileState): ProfileState {
  const stats = computeProfileStats(profile.geometry);
  const blankWidthIn = computeBlankWidth(profile.geometry, profile.materialId, profile.gaugeId);
  return { ...profile, blankWidthIn, bendCount: stats.bendCount, hemCount: stats.hemCount };
}

function pushHistory(state: FlashDraftState): Pick<FlashDraftState, 'history' | 'future'> {
  return { history: [...state.history, state.profile].slice(-HISTORY_LIMIT), future: [] };
}

export const initialFlashDraftState: FlashDraftState = {
  profile: {
    geometry: { legs: [], bendPoints: [], hems: [] },
    name: 'Untitled Profile',
    revision: 0,
    savedProfileId: null,
    materialId: null,
    gaugeId: null,
    lengthFt: 10,
    lengthInExtra: 0,
    quantity: 1,
    notes: '',
    blankWidthIn: 0,
    bendCount: 0,
    hemCount: 0,
    paintFace: null,
  },
  interaction: { type: 'IDLE' },
  transform: { scale: 40, panOffsetX: 200, panOffsetY: 300 },
  activeView: '2d',
  hemPopup: { visible: false, hemId: null },
  history: [],
  future: [],
  isDirty: false,
};

// --- Local geometry-editing helpers (state-shape aware, so they live here
// rather than in the pure-math geometry.ts) ---

function translateFromLegIndex(geometry: ProfileGeometry, legIndex: number, delta: GeoPoint): ProfileGeometry {
  const legs = geometry.legs.map((leg, i) => {
    if (i <= legIndex) return leg;
    return {
      ...leg,
      startGeo: { x: leg.startGeo.x + delta.x, y: leg.startGeo.y + delta.y },
      endGeo: { x: leg.endGeo.x + delta.x, y: leg.endGeo.y + delta.y },
    };
  });
  const bendPoints = geometry.bendPoints.map((b, i) => {
    if (i < legIndex) return b;
    return { ...b, geo: { x: b.geo.x + delta.x, y: b.geo.y + delta.y } };
  });
  return { legs, bendPoints, hems: geometry.hems };
}

function rotateDownstreamAroundBend(geometry: ProfileGeometry, bendIndex: number, pivot: GeoPoint, deltaRad: number): ProfileGeometry {
  const bend = geometry.bendPoints[bendIndex];
  const outgoingLegIndex = geometry.legs.findIndex((l) => l.id === bend.outgoingLegId);
  const legs = geometry.legs.map((leg, i) => {
    if (outgoingLegIndex === -1 || i < outgoingLegIndex) return leg;
    return {
      ...leg,
      startGeo: rotatePoint(leg.startGeo, pivot, deltaRad),
      endGeo: rotatePoint(leg.endGeo, pivot, deltaRad),
      angleRad: leg.angleRad + deltaRad,
    };
  });
  const bendPoints = geometry.bendPoints.map((b, i) => {
    if (i <= bendIndex) return b;
    return { ...b, geo: rotatePoint(b.geo, pivot, deltaRad) };
  });
  return { legs, bendPoints, hems: geometry.hems };
}

function recomputeBendAngle(geometry: ProfileGeometry, bendIndex: number): number {
  const bend = geometry.bendPoints[bendIndex];
  const incomingLeg = geometry.legs.find((l) => l.id === bend.incomingLegId);
  const outgoingLeg = geometry.legs.find((l) => l.id === bend.outgoingLegId);
  if (!incomingLeg || !outgoingLeg) return bend.angleDegrees;
  const v1 = { x: incomingLeg.startGeo.x - bend.geo.x, y: incomingLeg.startGeo.y - bend.geo.y };
  const v2 = { x: outgoingLeg.endGeo.x - bend.geo.x, y: outgoingLeg.endGeo.y - bend.geo.y };
  return signedAngleBetween(v1, v2);
}

function gapInForHemType(type: Hem['type'], gaugeId: string | null): number {
  if (type === 'teardrop') return gaugeThicknessInFromCatalog(gaugeId) / 2;
  if (type === 'smashed') return 0;
  return HEM_DEFAULT_GAP_IN;
}

function applySnappedDraw(anchor: GeoPoint, raw: GeoPoint): GeoPoint {
  const dx = raw.x - anchor.x;
  const dy = raw.y - anchor.y;
  const length = snapLength(Math.hypot(dx, dy));
  const angleRad = snapAngle(Math.atan2(dy, dx));
  return { x: anchor.x + Math.cos(angleRad) * length, y: anchor.y + Math.sin(angleRad) * length };
}

// --- Reducer ---

export function flashDraftReducer(state: FlashDraftState, action: FlashDraftAction): FlashDraftState {
  const { profile, interaction, transform } = state;
  const { geometry } = profile;

  switch (action.type) {
    case 'POINTER_DOWN': {
      // Double-click already armed hem-drawing mode (see DOUBLE_CLICK) —
      // this pointer-down is the "click to commit" half of that gesture,
      // not a new hit-test.
      if (interaction.type === 'DRAWING_HEM') return state;

      if (action.buttons === 4 || action.spaceDown) {
        return { ...state, interaction: { type: 'PANNING', lastPixel: action.pixel } };
      }

      const hit = hitTest(action.pixel, geometry, transform, HIT_RADIUS_PX);

      if (hit.type === 'bend' && hit.id) {
        const bend = geometry.bendPoints.find((b) => b.id === hit.id);
        if (!bend) return state;
        return { ...state, interaction: { type: 'DRAGGING_BEND', bendPointId: hit.id, originalGeo: bend.geo } };
      }

      if (hit.type === 'hem_endpoint' && hit.hemId) {
        const hem = geometry.hems.find((h) => h.id === hit.hemId);
        if (!hem) return state;
        return { ...state, interaction: { type: 'DRAGGING_HEM_ENDPOINT', hemId: hit.hemId, originalLengthIn: hem.lengthIn } };
      }

      // Continuing the polyline from the last committed point takes
      // priority over a plain leg-hit specifically. A click exactly on the
      // last vertex is geometrically indistinguishable from a click on that
      // same leg's endpoint, so without this check hitTest's leg-hit branch
      // would win instead (hems only ever start via DOUBLE_CLICK, so
      // there's no hem-creation gesture this needs to be disambiguated
      // from). This runs after the bend/hem_endpoint checks above so an
      // existing hem or bend sitting at that exact point stays reachable.
      if (geometry.legs.length > 0) {
        const lastLeg = geometry.legs[geometry.legs.length - 1];
        const lastPointPx = geoToCanvas(lastLeg.endGeo, transform);
        if (pixelDistance(action.pixel, lastPointPx) <= HIT_RADIUS_PX) {
          return { ...state, interaction: { type: 'DRAWING', startGeo: lastLeg.endGeo, previewGeo: null } };
        }
      }

      if (hit.type === 'leg' && hit.id) {
        return { ...state, interaction: { type: 'SELECTED_LEG', legId: hit.id } };
      }

      // Empty space: start drawing. First leg starts from the click point;
      // subsequent legs always extend from the last committed point,
      // regardless of where exactly the click landed.
      if (geometry.legs.length === 0) {
        const startGeo = canvasToGeo(action.pixel, transform);
        return { ...state, interaction: { type: 'DRAWING', startGeo, previewGeo: null } };
      }
      const lastLeg = geometry.legs[geometry.legs.length - 1];
      return { ...state, interaction: { type: 'DRAWING', startGeo: lastLeg.endGeo, previewGeo: null } };
    }

    case 'POINTER_MOVE': {
      if (interaction.type === 'PANNING') {
        const dx = action.pixel.x - interaction.lastPixel.x;
        const dy = action.pixel.y - interaction.lastPixel.y;
        return {
          ...state,
          transform: { ...transform, panOffsetX: transform.panOffsetX + dx, panOffsetY: transform.panOffsetY + dy },
          interaction: { type: 'PANNING', lastPixel: action.pixel },
        };
      }

      if (interaction.type === 'DRAWING') {
        const raw = canvasToGeo(action.pixel, transform);
        const previewGeo = applySnappedDraw(interaction.startGeo, raw);
        return { ...state, interaction: { ...interaction, previewGeo } };
      }

      if (interaction.type === 'DRAGGING_BEND') {
        const raw = canvasToGeo(action.pixel, transform);
        const snapped = { x: Math.round(raw.x / 0.125) * 0.125, y: Math.round(raw.y / 0.125) * 0.125 };
        const newGeometry = dragBendPoint(geometry, interaction.bendPointId, snapped);
        const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
        return { ...state, profile: newProfile };
      }

      if (interaction.type === 'DRAGGING_HEM_ENDPOINT') {
        const hem = geometry.hems.find((h) => h.id === interaction.hemId);
        const leg = hem ? geometry.legs.find((l) => l.id === hem.legId) : undefined;
        if (!hem || !leg) return state;
        const anchor = pointAlongLeg(leg, hem.distanceFromStartIn / leg.lengthIn);
        const foldDirRad = leg.angleRad + Math.PI;
        const foldDir = { x: Math.cos(foldDirRad), y: Math.sin(foldDirRad) };
        const mouseGeo = canvasToGeo(action.pixel, transform);
        const vec = { x: mouseGeo.x - anchor.x, y: mouseGeo.y - anchor.y };
        const projected = vec.x * foldDir.x + vec.y * foldDir.y;
        const lengthIn = Math.max(0, snapLength(projected));
        const newGeometry = updateHem(geometry, hem.id, { lengthIn });
        return { ...state, profile: recomputeProfile({ ...profile, geometry: newGeometry }) };
      }

      if (interaction.type === 'DRAWING_HEM') {
        const leg = geometry.legs.find((l) => l.id === interaction.legId);
        if (!leg) return state;
        const anchor = pointAlongLeg(leg, interaction.startTParam);
        const foldDirRad = leg.angleRad + Math.PI;
        const foldDir = { x: Math.cos(foldDirRad), y: Math.sin(foldDirRad) };
        const mouseGeo = canvasToGeo(action.pixel, transform);
        const vec = { x: mouseGeo.x - anchor.x, y: mouseGeo.y - anchor.y };
        const projected = vec.x * foldDir.x + vec.y * foldDir.y;
        const previewLengthIn = Math.max(0, snapLength(projected));
        return { ...state, interaction: { ...interaction, previewLengthIn } };
      }

      return state;
    }

    case 'POINTER_UP': {
      if (interaction.type === 'PANNING') {
        return { ...state, interaction: { type: 'IDLE' } };
      }

      if (interaction.type === 'DRAWING') {
        if (!interaction.previewGeo) return { ...state, interaction: { type: 'IDLE' } };
        const distanceIn = geoDistance(interaction.startGeo, interaction.previewGeo);
        if (distanceIn < MIN_DRAG_SEGMENT_IN) return { ...state, interaction: { type: 'IDLE' } };

        const legId = newId();
        const newLeg: Leg = {
          id: legId,
          startGeo: interaction.startGeo,
          endGeo: interaction.previewGeo,
          lengthIn: distanceIn,
          angleRad: lineAngleRad(interaction.startGeo, interaction.previewGeo),
          hems: [],
        };

        let bendPoints = geometry.bendPoints;
        if (geometry.legs.length > 0) {
          const prevLeg = geometry.legs[geometry.legs.length - 1];
          const v1 = { x: prevLeg.startGeo.x - newLeg.startGeo.x, y: prevLeg.startGeo.y - newLeg.startGeo.y };
          const v2 = { x: newLeg.endGeo.x - newLeg.startGeo.x, y: newLeg.endGeo.y - newLeg.startGeo.y };
          const bend: BendPoint = {
            id: newId(),
            geo: newLeg.startGeo,
            angleDegrees: signedAngleBetween(v1, v2),
            radiusIn: defaultBendRadiusIn(profile.materialId),
            incomingLegId: prevLeg.id,
            outgoingLegId: newLeg.id,
          };
          bendPoints = [...bendPoints, bend];
        }

        const newGeometry: ProfileGeometry = { legs: [...geometry.legs, newLeg], bendPoints, hems: geometry.hems };
        const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
        const { history, future } = pushHistory(state);
        return { ...state, profile: newProfile, interaction: { type: 'DRAWING', startGeo: newLeg.endGeo, previewGeo: null }, history, future, isDirty: true };
      }

      if (interaction.type === 'DRAGGING_BEND') {
        const bend = geometry.bendPoints.find((b) => b.id === interaction.bendPointId);
        const moved = bend ? geoDistance(bend.geo, interaction.originalGeo) > 0.001 : false;
        if (!moved) {
          return { ...state, interaction: { type: 'SELECTED_BEND', bendPointId: interaction.bendPointId } };
        }
        // History should record the pre-drag profile, not the current
        // (already-dragged) one — reconstruct it with the bend restored.
        const preDragGeometry = dragBendPoint(geometry, interaction.bendPointId, interaction.originalGeo);
        const preDragProfile = recomputeProfile({ ...profile, geometry: preDragGeometry });
        return {
          ...state,
          interaction: { type: 'SELECTED_BEND', bendPointId: interaction.bendPointId },
          history: [...state.history, preDragProfile].slice(-HISTORY_LIMIT),
          future: [],
          isDirty: true,
        };
      }

      if (interaction.type === 'DRAGGING_HEM_ENDPOINT') {
        const { history, future } = pushHistory(state);
        return { ...state, interaction: { type: 'SELECTED_HEM', hemId: interaction.hemId }, history, future, isDirty: true };
      }

      if (interaction.type === 'DRAWING_HEM') {
        if (interaction.previewLengthIn < MIN_DRAG_SEGMENT_IN) {
          return { ...state, interaction: { type: 'IDLE' } };
        }
        const leg = geometry.legs.find((l) => l.id === interaction.legId);
        if (!leg) return { ...state, interaction: { type: 'IDLE' } };
        const hem: Hem = {
          id: newId(),
          legId: leg.id,
          distanceFromStartIn: interaction.startTParam * leg.lengthIn,
          lengthIn: interaction.previewLengthIn,
          type: 'open',
          gapIn: HEM_DEFAULT_GAP_IN,
        };
        const legs = geometry.legs.map((l) => (l.id === leg.id ? { ...l, hems: [...l.hems, hem] } : l));
        const newGeometry: ProfileGeometry = { legs, bendPoints: geometry.bendPoints, hems: [...geometry.hems, hem] };
        const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
        const { history, future } = pushHistory(state);
        return {
          ...state,
          profile: newProfile,
          interaction: { type: 'SELECTED_HEM', hemId: hem.id },
          hemPopup: { visible: true, hemId: hem.id },
          history,
          future,
          isDirty: true,
        };
      }

      return state;
    }

    case 'POINTER_LEAVE':
      return state;

    case 'DOUBLE_CLICK': {
      const hit = hitTest(action.pixel, geometry, transform, HIT_RADIUS_PX);
      if (hit.type === 'leg' && hit.id && hit.tParam !== undefined) {
        return { ...state, interaction: { type: 'DRAWING_HEM', legId: hit.id, startTParam: hit.tParam, previewLengthIn: 0 } };
      }
      return state;
    }

    case 'WHEEL': {
      const factor = Math.exp(-action.deltaY * ZOOM_STEP_RATIO);
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale * factor));
      const geoUnderCursor = canvasToGeo(action.pixel, transform);
      const panOffsetX = action.pixel.x - geoUnderCursor.x * newScale;
      const panOffsetY = action.pixel.y + geoUnderCursor.y * newScale;
      return { ...state, transform: { scale: newScale, panOffsetX, panOffsetY } };
    }

    case 'KEY_DOWN': {
      if (action.ctrl && action.key.toLowerCase() === 'z') return flashDraftReducer(state, { type: 'UNDO' });
      if (action.ctrl && action.key.toLowerCase() === 'y') return flashDraftReducer(state, { type: 'REDO' });
      if (action.key === 'Escape') {
        return { ...state, interaction: { type: 'IDLE' }, hemPopup: { visible: false, hemId: null } };
      }
      if (action.key === 'Delete' || action.key === 'Backspace') return flashDraftReducer(state, { type: 'DELETE_SELECTED' });
      return state;
    }

    case 'SET_LEG_LENGTH': {
      const legIndex = geometry.legs.findIndex((l) => l.id === action.legId);
      if (legIndex === -1) return state;
      const leg = geometry.legs[legIndex];
      const newEndGeo = {
        x: leg.startGeo.x + Math.cos(leg.angleRad) * action.lengthIn,
        y: leg.startGeo.y + Math.sin(leg.angleRad) * action.lengthIn,
      };
      const delta = { x: newEndGeo.x - leg.endGeo.x, y: newEndGeo.y - leg.endGeo.y };
      const translated = translateFromLegIndex(geometry, legIndex, delta);
      const legs = translated.legs.map((l, i) => (i === legIndex ? { ...l, endGeo: newEndGeo, lengthIn: action.lengthIn } : l));
      const newGeometry: ProfileGeometry = { legs, bendPoints: translated.bendPoints, hems: geometry.hems };
      const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
      const { history, future } = pushHistory(state);
      return { ...state, profile: newProfile, history, future, isDirty: true };
    }

    case 'SET_BEND_ANGLE': {
      const bendIndex = geometry.bendPoints.findIndex((b) => b.id === action.bendPointId);
      if (bendIndex === -1) return state;
      const bend = geometry.bendPoints[bendIndex];
      const deltaDeg = action.angleDegrees - bend.angleDegrees;
      const deltaRad = (deltaDeg * Math.PI) / 180;
      const rotated = rotateDownstreamAroundBend(geometry, bendIndex, bend.geo, deltaRad);
      const bendPoints = rotated.bendPoints.map((b, i) => (i === bendIndex ? { ...b, angleDegrees: action.angleDegrees } : b));
      const newGeometry: ProfileGeometry = { legs: rotated.legs, bendPoints, hems: geometry.hems };
      const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
      const { history, future } = pushHistory(state);
      return { ...state, profile: newProfile, history, future, isDirty: true };
    }

    case 'SET_BEND_RADIUS': {
      const clamped = Math.max(MIN_BEND_RADIUS_IN, Math.min(MAX_BEND_RADIUS_IN, action.radiusIn));
      const bendPoints = geometry.bendPoints.map((b) => (b.id === action.bendPointId ? { ...b, radiusIn: clamped } : b));
      const newGeometry: ProfileGeometry = { ...geometry, bendPoints };
      return { ...state, profile: recomputeProfile({ ...profile, geometry: newGeometry }), isDirty: true };
    }

    case 'SET_HEM_TYPE':
    case 'SELECT_HEM_TYPE_FROM_POPUP': {
      const gapIn = gapInForHemType(action.hemType, profile.gaugeId);
      const newGeometry = updateHem(geometry, action.hemId, { type: action.hemType, gapIn });
      const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
      const nextHemPopup =
        action.type === 'SELECT_HEM_TYPE_FROM_POPUP'
          ? { visible: action.hemType === 'open', hemId: action.hemType === 'open' ? action.hemId : null }
          : state.hemPopup;
      const { history, future } = pushHistory(state);
      return { ...state, profile: newProfile, hemPopup: nextHemPopup, history, future, isDirty: true };
    }

    case 'SET_HEM_LENGTH': {
      const newGeometry = updateHem(geometry, action.hemId, { lengthIn: Math.max(MIN_DRAG_SEGMENT_IN, action.lengthIn) });
      const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
      const { history, future } = pushHistory(state);
      return { ...state, profile: newProfile, history, future, isDirty: true };
    }

    case 'SET_HEM_GAP': {
      const newGeometry = updateHem(geometry, action.hemId, { gapIn: Math.max(0, action.gapIn) });
      return { ...state, profile: recomputeProfile({ ...profile, geometry: newGeometry }), isDirty: true };
    }

    case 'DELETE_SELECTED': {
      if (interaction.type === 'SELECTED_LEG') {
        return deleteLeg(state, interaction.legId);
      }
      if (interaction.type === 'SELECTED_BEND') {
        return deleteBend(state, interaction.bendPointId);
      }
      if (interaction.type === 'SELECTED_HEM') {
        const hem = geometry.hems.find((h) => h.id === interaction.hemId);
        if (!hem) return state;
        const legs = geometry.legs.map((l) => (l.id === hem.legId ? { ...l, hems: l.hems.filter((h) => h.id !== hem.id) } : l));
        const hems = geometry.hems.filter((h) => h.id !== hem.id);
        const newGeometry: ProfileGeometry = { legs, bendPoints: geometry.bendPoints, hems };
        const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
        const { history, future } = pushHistory(state);
        return { ...state, profile: newProfile, interaction: { type: 'IDLE' }, history, future, isDirty: true };
      }
      return state;
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        profile: prev,
        history: state.history.slice(0, -1),
        future: [state.profile, ...state.future],
        interaction: { type: 'IDLE' },
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        profile: next,
        history: [...state.history, state.profile],
        future: state.future.slice(1),
        interaction: { type: 'IDLE' },
      };
    }

    case 'CLEAR': {
      const { history, future } = pushHistory(state);
      const profileCleared = recomputeProfile({
        ...profile,
        geometry: { legs: [], bendPoints: [], hems: [] },
        name: 'Untitled Profile',
        revision: 0,
        savedProfileId: null,
      });
      return { ...state, profile: profileCleared, interaction: { type: 'IDLE' }, hemPopup: { visible: false, hemId: null }, history, future, isDirty: false };
    }

    case 'ROTATE_LEFT':
    case 'ROTATE_RIGHT': {
      if (geometry.legs.length === 0) return state;
      const deltaRad = ((action.type === 'ROTATE_LEFT' ? -15 : 15) * Math.PI) / 180;
      const pivot = centroidOfGeometry(geometry);
      const legs = geometry.legs.map((leg) => ({
        ...leg,
        startGeo: rotatePoint(leg.startGeo, pivot, deltaRad),
        endGeo: rotatePoint(leg.endGeo, pivot, deltaRad),
        angleRad: leg.angleRad + deltaRad,
      }));
      const bendPoints = geometry.bendPoints.map((b) => ({ ...b, geo: rotatePoint(b.geo, pivot, deltaRad) }));
      const newGeometry: ProfileGeometry = { legs, bendPoints, hems: geometry.hems };
      const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
      const { history, future } = pushHistory(state);
      return { ...state, profile: newProfile, history, future, isDirty: true };
    }

    case 'FIT_TO_SCREEN': {
      if (geometry.legs.length === 0) {
        return { ...state, transform: { ...transform, panOffsetX: action.canvasWidth / 2, panOffsetY: action.canvasHeight / 2 } };
      }
      const xs: number[] = [];
      const ys: number[] = [];
      geometry.legs.forEach((l) => {
        xs.push(l.startGeo.x, l.endGeo.x);
        ys.push(l.startGeo.y, l.endGeo.y);
      });
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const widthIn = Math.max(maxX - minX, 0.5);
      const heightIn = Math.max(maxY - minY, 0.5);
      const scale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, Math.min(action.canvasWidth / (widthIn * FIT_MARGIN_FACTOR), action.canvasHeight / (heightIn * FIT_MARGIN_FACTOR)))
      );
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const panOffsetX = action.canvasWidth / 2 - centerX * scale;
      const panOffsetY = action.canvasHeight / 2 + centerY * scale;
      return { ...state, transform: { scale, panOffsetX, panOffsetY } };
    }

    case 'SET_PAN':
      return { ...state, transform: { ...transform, panOffsetX: action.panOffsetX, panOffsetY: action.panOffsetY } };

    case 'SET_ZOOM': {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, action.scale));
      const geoUnderCursor = canvasToGeo(action.pixel, transform);
      const panOffsetX = action.pixel.x - geoUnderCursor.x * newScale;
      const panOffsetY = action.pixel.y + geoUnderCursor.y * newScale;
      return { ...state, transform: { scale: newScale, panOffsetX, panOffsetY } };
    }

    case 'SELECT_ADJACENT_BEND': {
      const bendPoints = geometry.bendPoints;
      if (bendPoints.length === 0) return state;
      if (interaction.type !== 'SELECTED_BEND') {
        const next = action.direction === 1 ? bendPoints[0] : bendPoints[bendPoints.length - 1];
        return { ...state, interaction: { type: 'SELECTED_BEND', bendPointId: next.id } };
      }
      const currentIndex = bendPoints.findIndex((b) => b.id === interaction.bendPointId);
      const nextIndex = (currentIndex + action.direction + bendPoints.length) % bendPoints.length;
      return { ...state, interaction: { type: 'SELECTED_BEND', bendPointId: bendPoints[nextIndex].id } };
    }

    case 'SET_MATERIAL':
      return { ...state, profile: recomputeProfile({ ...profile, materialId: action.materialId }) };

    case 'SET_GAUGE':
      return { ...state, profile: recomputeProfile({ ...profile, gaugeId: action.gaugeId }) };

    case 'SET_LENGTH_FT':
      return { ...state, profile: { ...profile, lengthFt: Math.max(0, action.ft) } };

    case 'SET_LENGTH_IN':
      return { ...state, profile: { ...profile, lengthInExtra: Math.max(0, Math.min(11.875, action.inches)) } };

    case 'SET_QUANTITY':
      return { ...state, profile: { ...profile, quantity: Math.max(1, Math.round(action.quantity)) } };

    case 'SET_NOTES':
      return { ...state, profile: { ...profile, notes: action.notes } };

    case 'SET_PROFILE_NAME':
      return { ...state, profile: { ...profile, name: action.name } };

    case 'SET_PAINT_FACE':
      return { ...state, profile: { ...profile, paintFace: action.face } };

    case 'LOAD_PROFILE': {
      const { history, future } = pushHistory(state);
      return {
        ...state,
        profile: recomputeProfile(action.profile),
        interaction: { type: 'IDLE' },
        hemPopup: { visible: false, hemId: null },
        history,
        future,
        isDirty: false,
      };
    }

    case 'MARK_SAVED':
      return { ...state, profile: { ...profile, savedProfileId: action.profileId, name: action.name, revision: profile.revision + 1 }, isDirty: false };

    case 'CLOSE_HEM_POPUP':
      return { ...state, hemPopup: { visible: false, hemId: null } };

    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.view };

    default:
      return state;
  }
}

function updateHem(geometry: ProfileGeometry, hemId: string, patch: Partial<Hem>): ProfileGeometry {
  const legs = geometry.legs.map((l) => ({
    ...l,
    hems: l.hems.map((h) => (h.id === hemId ? { ...h, ...patch } : h)),
  }));
  const hems = geometry.hems.map((h) => (h.id === hemId ? { ...h, ...patch } : h));
  return { legs, bendPoints: geometry.bendPoints, hems };
}

// Deleting an end leg just shortens the polyline; deleting a middle leg
// bridges the gap by joining the leg before it directly to the leg after
// it (translating everything from that point on), so the chain stays
// connected — "reattach if possible".
function deleteLeg(state: FlashDraftState, legId: string): FlashDraftState {
  const { profile } = state;
  const { geometry } = profile;
  const legIndex = geometry.legs.findIndex((l) => l.id === legId);
  if (legIndex === -1) return state;

  let newGeometry: ProfileGeometry;

  if (geometry.legs.length === 1) {
    newGeometry = { legs: [], bendPoints: [], hems: [] };
  } else if (legIndex === 0) {
    const legs = geometry.legs.slice(1);
    const bendPoints = geometry.bendPoints.slice(1);
    const hems = geometry.hems.filter((h) => h.legId !== legId);
    newGeometry = { legs, bendPoints, hems };
  } else if (legIndex === geometry.legs.length - 1) {
    const legs = geometry.legs.slice(0, -1);
    const bendPoints = geometry.bendPoints.slice(0, -1);
    const hems = geometry.hems.filter((h) => h.legId !== legId);
    newGeometry = { legs, bendPoints, hems };
  } else {
    const before = geometry.legs[legIndex - 1];
    const after = geometry.legs[legIndex + 1];
    const bridgeGeo = before.endGeo;
    const delta = { x: bridgeGeo.x - after.startGeo.x, y: bridgeGeo.y - after.startGeo.y };
    const translated = translateFromLegIndex(geometry, legIndex, delta);
    const legs = translated.legs.filter((l) => l.id !== legId);
    const bendPoints = translated.bendPoints.filter((b) => b.incomingLegId !== legId && b.outgoingLegId !== legId);
    const bridgeBend: BendPoint = {
      id: newId(),
      geo: bridgeGeo,
      angleDegrees: 180,
      radiusIn: defaultBendRadiusIn(profile.materialId),
      incomingLegId: before.id,
      outgoingLegId: after.id,
    };
    const insertAt = legIndex - 1;
    bendPoints.splice(insertAt, 0, bridgeBend);
    const bridgeIndex = bendPoints.findIndex((b) => b.id === bridgeBend.id);
    const angleDegrees = recomputeBendAngle({ legs, bendPoints, hems: geometry.hems }, bridgeIndex);
    bendPoints[bridgeIndex] = { ...bendPoints[bridgeIndex], angleDegrees };
    const hems = geometry.hems.filter((h) => h.legId !== legId);
    newGeometry = { legs, bendPoints, hems };
  }

  const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
  const { history, future } = pushHistory(state);
  return { ...state, profile: newProfile, interaction: { type: 'IDLE' }, history, future, isDirty: true };
}

// Deleting a bend merges its two adjacent legs into one straight leg. Hems
// on either of those two legs are dropped — once the bend disappears,
// neither leg's original fold direction survives to anchor them to.
function deleteBend(state: FlashDraftState, bendId: string): FlashDraftState {
  const { profile } = state;
  const { geometry } = profile;
  const bendIndex = geometry.bendPoints.findIndex((b) => b.id === bendId);
  if (bendIndex === -1) return state;
  const bend = geometry.bendPoints[bendIndex];
  const incomingIndex = geometry.legs.findIndex((l) => l.id === bend.incomingLegId);
  const outgoingIndex = geometry.legs.findIndex((l) => l.id === bend.outgoingLegId);
  if (incomingIndex === -1 || outgoingIndex === -1) return state;
  const incomingLeg = geometry.legs[incomingIndex];
  const outgoingLeg = geometry.legs[outgoingIndex];

  const merged: Leg = {
    id: newId(),
    startGeo: incomingLeg.startGeo,
    endGeo: outgoingLeg.endGeo,
    lengthIn: geoDistance(incomingLeg.startGeo, outgoingLeg.endGeo),
    angleRad: lineAngleRad(incomingLeg.startGeo, outgoingLeg.endGeo),
    hems: [],
  };

  const legs = geometry.legs.slice(0, incomingIndex).concat([merged], geometry.legs.slice(outgoingIndex + 1));
  const bendPoints = geometry.bendPoints
    .filter((b) => b.id !== bendId)
    .map((b) => {
      if (b.incomingLegId === outgoingLeg.id) return { ...b, incomingLegId: merged.id };
      if (b.outgoingLegId === incomingLeg.id) return { ...b, outgoingLegId: merged.id };
      return b;
    });
  const hems = geometry.hems.filter((h) => h.legId !== incomingLeg.id && h.legId !== outgoingLeg.id);
  const newGeometry: ProfileGeometry = { legs, bendPoints, hems };

  const newProfile = recomputeProfile({ ...profile, geometry: newGeometry });
  const { history, future } = pushHistory(state);
  return { ...state, profile: newProfile, interaction: { type: 'IDLE' }, history, future, isDirty: true };
}
