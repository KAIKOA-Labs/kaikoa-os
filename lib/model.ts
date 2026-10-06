export type EntityType = "person" | "asset" | "credential";
export type EntitySubtype = "vessel" | "property" | "digital_asset" | "passport" | "person";
export type ObligationStatus = "OK" | "UPCOMING" | "ATTENTION" | "WAITING" | "BLOCKED" | "OVERDUE" | "COMPLETED";

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  subtype: EntitySubtype;
  status: string;
  location?: string;
  reportingValueUsd?: number;
  dataQuality: "verified" | "partial" | "unverified";
}

export interface Relationship {
  id: string;
  subjectId: string;
  type: "OWNS" | "HOLDS";
  objectId: string;
}

export interface Obligation {
  id: string;
  title: string;
  relatedEntityId: string;
  status: ObligationStatus;
  importance: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  dueAt?: string;
  nextAction: string;
  requiresOwnerAttention: boolean;
  sourceState: "VERIFIED" | "USER_CONFIRMED" | "UNVERIFIED";
}
