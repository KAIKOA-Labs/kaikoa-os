import type { Entity, Obligation, Relationship } from "./model";

export const entities: Entity[] = [
  { id: "eduardo", name: "Eduardo", type: "person", subtype: "person", status: "ACTIVE", dataQuality: "verified" },
  { id: "kaikoa", name: "KAIKOA", type: "asset", subtype: "vessel", status: "ACTIVE", location: "CM4 · Baie de Phaëton · Tahiti", dataQuality: "partial" },
  { id: "burgos", name: "Burgos Ocean View", type: "asset", subtype: "property", status: "OWNED · COMPLETION OUTSTANDING", location: "Burgos · Siargao", dataQuality: "partial" },
  { id: "kaikoa-com", name: "kaikoa.com", type: "asset", subtype: "digital_asset", status: "OWNED · CRITICAL", dataQuality: "partial" },
  { id: "spanish-passport", name: "Spanish Passport", type: "credential", subtype: "passport", status: "ACTIVE", dataQuality: "partial" }
];

export const relationships: Relationship[] = [
  { id: "r1", subjectId: "eduardo", type: "OWNS", objectId: "kaikoa" },
  { id: "r2", subjectId: "eduardo", type: "OWNS", objectId: "burgos" },
  { id: "r3", subjectId: "eduardo", type: "OWNS", objectId: "kaikoa-com" },
  { id: "r4", subjectId: "eduardo", type: "HOLDS", objectId: "spanish-passport" }
];

export const obligations: Obligation[] = [
  {
    id: "o1",
    title: "Verify kaikoa.com renewal protection",
    relatedEntityId: "kaikoa-com",
    status: "ATTENTION",
    importance: "CRITICAL",
    nextAction: "Verify registrar, renewal date, auto-renew and backup payment setup.",
    requiresOwnerAttention: true,
    sourceState: "USER_CONFIRMED"
  },
  {
    id: "o2",
    title: "Reconcile remaining Burgos 2026 payment",
    relatedEntityId: "burgos",
    status: "UPCOMING",
    importance: "HIGH",
    dueAt: "2026-12-31",
    nextAction: "Verify exact balance from purchase documents and payment history.",
    requiresOwnerAttention: true,
    sourceState: "USER_CONFIRMED"
  },
  {
    id: "o3",
    title: "Verify Spanish passport expiry",
    relatedEntityId: "spanish-passport",
    status: "OK",
    importance: "NORMAL",
    nextAction: "Read authoritative passport details before creating renewal timing.",
    requiresOwnerAttention: false,
    sourceState: "UNVERIFIED"
  }
];
