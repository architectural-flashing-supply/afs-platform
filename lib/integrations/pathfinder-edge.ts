/**
 * PathfinderEdge machine-integration stub.
 *
 * A live discovery pass was run against https://afs.pathfinderedge.com using
 * the configured API key (Bearer auth against /api, /api/v1, /api/profiles,
 * /api/catalogs, /api/jobs, /api/machines, plus Swagger/OpenAPI discovery
 * paths). Findings: the host is real (Azure-hosted ASP.NET Core/Kestrel), but
 * every one of those paths returned 404, `/` redirects to `/login` (session
 * auth, not bearer-token REST), and there is no discoverable API documentation
 * anywhere on the host. There is no confirmed real endpoint to integrate
 * against yet.
 *
 * Every export here returns a stable "not_configured" result and makes zero
 * network calls, so callers (admin UI, future job-submission triggers) have a
 * real interface to build against without sending guessed requests — with no
 * real API docs, any request body/response shape would be fabricated, and
 * submitJobToMachine ultimately drives a physical bending machine (serial
 * P0700707), so guessing here is not an acceptable substitute for real
 * documentation.
 */

export type PathfinderStatus = 'not_configured' | 'connected' | 'error';

export interface PathfinderResult {
  status: PathfinderStatus;
  message: string;
}

export interface PathfinderEndpoints extends PathfinderResult {
  endpoints: Record<string, number>;
}

export interface Catalog {
  id: string;
  name: string;
}

export interface MachineProfileBend {
  stepNumber: number;
  leftLegMm: number | null;
  rightLegMm: number | null;
  bendAngleDegrees: number | null;
  radiusMm: number | null;
}

export interface MachineProfile {
  id: string;
  nameEn: string;
  profileNumber: string;
  blankWidthMm: number | null;
  bends: MachineProfileBend[];
}

export interface PathfinderProfile extends PathfinderResult {
  profileId: string | null;
}

export interface Job extends PathfinderResult {
  jobId: string | null;
}

export interface JobStatus extends PathfinderResult {
  jobId: string;
  state: 'unknown';
}

const NOT_CONFIGURED_MESSAGE =
  'PathfinderEdge integration pending real API documentation — no REST API was discoverable at afs.pathfinderedge.com (only /health and /status respond; the app redirects to session login, not a bearer-token API)';

function notConfigured(): PathfinderResult {
  return { status: 'not_configured', message: NOT_CONFIGURED_MESSAGE };
}

export async function discoverApiEndpoints(): Promise<PathfinderEndpoints> {
  return { ...notConfigured(), endpoints: {} };
}

export async function getPathfinderCatalogs(): Promise<Catalog[]> {
  return [];
}

export async function pushProfileToPathfinder(
  _profile: MachineProfile,
  _catalogId: string
): Promise<PathfinderProfile> {
  return { ...notConfigured(), profileId: null };
}

export async function submitJobToMachine(
  _profileId: string,
  _quantity: number,
  _material: string,
  _notes: string
): Promise<Job> {
  return { ...notConfigured(), jobId: null };
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return { ...notConfigured(), jobId, state: 'unknown' };
}
