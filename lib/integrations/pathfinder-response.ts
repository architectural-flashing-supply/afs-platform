/**
 * F-09 — THE VENDOR'S RESPONSES ARE VALIDATED, NOT CAST.
 *
 * Every read from PathfinderEdge used to end in a cast:
 *
 *     const data = (await res.json()) as { catalogId: number; catalogName: string }[];
 *
 * A cast is erased at runtime. It asserts nothing. If AMS Controls renames a
 * field, wraps the array in an envelope, or returns an error object with a 200,
 * that line succeeds and the wrongness surfaces somewhere else entirely —
 * `data.map` throwing "data.map is not a function" inside a server component, or
 * worse, `String(undefined)` quietly rendering a catalog list of "undefined".
 * This is a third-party API this codebase does not control and cannot pin.
 *
 * So every read goes through a parser here. A parser does three things and
 * nothing else: it checks the shape it was promised, it returns a typed value or
 * a list of plain-English problems, and it never throws. The caller decides what
 * a bad shape means — for a list screen it means "show nothing and say why", and
 * for the profile-id lookup after a push it means `send_status='unconfirmed'`
 * (CLAUDE.md rule #16), never a retry.
 *
 * WHAT IS DELIBERATELY NOT HERE. No schema library was added. These are two
 * small, fully-documented response shapes
 * (https://docs.amscontrols.com/pathfinderEdge/publicapi); a dependency to
 * validate them would be more surface than the thing being validated, and the
 * explanatory failure messages are the point — a generic validator's
 * "expected string at [3].catalogName" is less use at 6am on a shop floor than
 * the sentences below.
 */

export interface ShapeOk<T> {
  ok: true;
  value: T;
}

export interface ShapeBad {
  ok: false;
  /** Plain-English, one per thing that is wrong. Capped — see MAX_PROBLEMS. */
  problems: string[];
}

export type ShapeResult<T> = ShapeOk<T> | ShapeBad;

/**
 * A malformed payload can be malformed in every one of its rows. Reporting all
 * 71 of them buries the one line that matters, so the list stops here and says
 * how many more there were.
 */
const MAX_PROBLEMS = 5;

/** How much of a bad payload gets logged. Enough to recognise, not enough to flood. */
const MAX_LOGGED_PAYLOAD_CHARS = 600;

export interface PathfinderCatalogSummary {
  id: string;
  name: string;
}

export interface PathfinderProfileSummary {
  profileId: number;
  profileName: string;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function collect(problems: string[], message: string): void {
  if (problems.length < MAX_PROBLEMS) problems.push(message);
}

function finish<T>(problems: string[], value: T, rowCount: number): ShapeResult<T> {
  if (problems.length === 0) return { ok: true, value };
  if (rowCount > MAX_PROBLEMS && problems.length === MAX_PROBLEMS) {
    problems.push(`(only the first ${MAX_PROBLEMS} problems are listed; the response had ${rowCount} entries)`);
  }
  return { ok: false, problems };
}

/**
 * `GET /api/v1/catalogs` → `[{ catalogId, catalogName }, …]`.
 *
 * `catalogId` is documented as a number but is accepted as a numeric string too:
 * JSON APIs commonly widen integer ids to strings to survive 53-bit precision
 * limits, and this codebase immediately stringifies it anyway
 * (`AFS_MACHINE_CATALOG_ID` is the string '20115'). Accepting both is tolerance
 * of a harmless difference, not of a wrong shape — a non-numeric id is still
 * rejected.
 */
export function parseCatalogList(raw: unknown): ShapeResult<PathfinderCatalogSummary[]> {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      problems: [`PathfinderEdge returned ${describe(raw)} where the catalog list should be an array.`],
    };
  }

  const problems: string[] = [];
  const value: PathfinderCatalogSummary[] = [];

  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      collect(problems, `Catalog ${i} is ${describe(row)}, not an object.`);
      return;
    }
    const r = row as Record<string, unknown>;
    const idRaw = r.catalogId;
    const id =
      typeof idRaw === 'number' && Number.isFinite(idRaw)
        ? String(idRaw)
        : typeof idRaw === 'string' && idRaw.trim() !== '' && Number.isFinite(Number(idRaw))
          ? idRaw.trim()
          : null;
    if (id === null) {
      collect(problems, `Catalog ${i} has no usable catalogId (got ${describe(idRaw)}: ${JSON.stringify(idRaw)}).`);
      return;
    }
    const name = r.catalogName;
    if (typeof name !== 'string' || name.trim() === '') {
      collect(problems, `Catalog ${i} (id ${id}) has no catalogName (got ${describe(name)}).`);
      return;
    }
    value.push({ id, name });
  });

  return finish(problems, value, raw.length);
}

/**
 * `GET /api/v1/profiles?catalog=…` → `[{ profileId, profileName }, …]`.
 *
 * This is the read that resolves the number a just-created profile was assigned,
 * which is the number printed back to the admin and stored on the job. The
 * `profileId` here stays a NUMBER rather than being widened like `catalogId`
 * above, because the caller compares ids with `>` to pick the most recently
 * created of two same-named profiles — a string comparison there would order
 * "9" above "10".
 */
export function parseProfileSummaryList(raw: unknown): ShapeResult<PathfinderProfileSummary[]> {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      problems: [`PathfinderEdge returned ${describe(raw)} where the profile list should be an array.`],
    };
  }

  const problems: string[] = [];
  const value: PathfinderProfileSummary[] = [];

  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      collect(problems, `Profile ${i} is ${describe(row)}, not an object.`);
      return;
    }
    const r = row as Record<string, unknown>;
    const idRaw = r.profileId;
    const profileId =
      typeof idRaw === 'number' && Number.isFinite(idRaw)
        ? idRaw
        : typeof idRaw === 'string' && idRaw.trim() !== '' && Number.isFinite(Number(idRaw))
          ? Number(idRaw)
          : null;
    if (profileId === null) {
      collect(problems, `Profile ${i} has no usable profileId (got ${describe(idRaw)}: ${JSON.stringify(idRaw)}).`);
      return;
    }
    const profileName = r.profileName;
    if (typeof profileName !== 'string') {
      collect(problems, `Profile ${i} (id ${profileId}) has no profileName (got ${describe(profileName)}).`);
      return;
    }
    value.push({ profileId, profileName });
  });

  return finish(problems, value, raw.length);
}

/**
 * THE SERVER-SIDE RECORD OF A CHANGED VENDOR PAYLOAD.
 *
 * Writes one `console.error` line — which on Vercel is a real, searchable
 * runtime log — carrying the endpoint, every problem found, and a truncated copy
 * of what actually arrived. The truncated payload is what makes the log
 * actionable: "Catalog 0 has no catalogName" is a symptom, and the 600
 * characters underneath it are the diagnosis.
 *
 * Returns the line it logged so a test can assert on the real string rather than
 * on a spy's arguments, and so a caller can put it in an audit row if it ever
 * wants to. It never throws: a logging failure must not be able to turn a
 * degraded read into a broken one.
 */
export function logVendorShapeProblem(endpoint: string, problems: string[], raw: unknown): string {
  let payload: string;
  try {
    payload = typeof raw === 'string' ? raw : JSON.stringify(raw);
  } catch {
    payload = '<payload could not be serialised>';
  }
  if (payload === undefined) payload = String(raw);
  const truncated =
    payload.length > MAX_LOGGED_PAYLOAD_CHARS
      ? `${payload.slice(0, MAX_LOGGED_PAYLOAD_CHARS)}… (${payload.length} chars total)`
      : payload;

  const line = `[PATHFINDER_SHAPE] ${endpoint} returned a payload that does not match the documented shape. ${problems.join(' ')} Payload: ${truncated}`;
  try {
    console.error(line);
  } catch {
    /* a broken console must never break a read */
  }
  return line;
}
