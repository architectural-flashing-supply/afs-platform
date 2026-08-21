// Shared between app/api/quote-requests/route.ts (the single real insert
// path into quote_requests — see afs-sv-008) and every UI surface that
// displays quote_requests.source_tool (added in migration
// 016_source_tool_and_shop_profile_library.sql, afs-sv-007). One list here
// keeps the set of tokens the API route accepts in sync with the labels
// the UI knows how to render — a new submission tool must be added here,
// not invented ad hoc at the call site.
export type SourceTool = 'afs-flashdraft' | 'afs-configurator' | 'afs-quote-builder' | 'afs-takeoff';

export const SOURCE_TOOL_LABEL: Record<SourceTool, string> = {
  'afs-flashdraft': 'FlashDraft',
  'afs-configurator': 'Configurator',
  'afs-quote-builder': 'Quote Builder',
  'afs-takeoff': 'Blueprint Takeoff AI',
};

const SOURCE_TOOLS = Object.keys(SOURCE_TOOL_LABEL) as SourceTool[];

export function isSourceTool(value: unknown): value is SourceTool {
  return typeof value === 'string' && (SOURCE_TOOLS as string[]).includes(value);
}

// quote_requests.source_tool has no CHECK constraint (free TEXT, default
// 'unknown') — rows written before afs-sv-008, or by any future caller that
// forgets to send a recognized token, fall back to this label rather than
// rendering a raw unfamiliar string in the admin UI.
export function sourceToolLabel(value: string | null | undefined): string {
  return isSourceTool(value) ? SOURCE_TOOL_LABEL[value] : 'Unknown';
}
