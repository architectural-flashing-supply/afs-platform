export interface BidProject {
  externalId: string;
  sourceId: string;
  title: string;
  description?: string;
  agency?: string;
  locationCity?: string;
  locationState?: string;
  bidDueDate?: Date;
  estimatedValue?: number;
  sourceUrl?: string;
  keywordsMatched: string[];
  division7Relevant: boolean;
  rawData: Record<string, unknown>;
}

export interface BidSource {
  id: string;
  name: string;
  sourceType: string;
  state?: string;
  url: string;
  isActive: boolean;
  isFree: boolean;
  notes?: string;
  lastCheckedAt?: Date;
}
