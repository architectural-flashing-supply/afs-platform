export interface KnowledgeChunk {
  id: string;
  category: string;
  subcategory: string;
  topic: string;
  content: string;
  keywords: string[];
  // Optional provenance tag for chunks that need to distinguish their
  // origin (e.g. AFS-authored guidance vs. Division 7 reference content).
  // Undefined on existing chunks — additive only, no other file sets it.
  source?: string;
}
