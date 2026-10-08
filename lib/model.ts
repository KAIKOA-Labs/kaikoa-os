export type EntityType = "person" | "asset" | "credential";
export type EntitySubtype = "vessel" | "property" | "digital_asset" | "passport" | "person";
export type ObligationStatus = "OK" | "UPCOMING" | "ATTENTION" | "WAITING" | "BLOCKED" | "OVERDUE" | "COMPLETED" | "IN_PROGRESS" | "WAITING_ON" | "SCHEDULED" | "DEFERRED" | "ARCHIVED";
export interface Entity { id:string; name:string; type:EntityType; subtype:EntitySubtype; status:string; location?:string; description?:string; details?:{label:string;value:string}[]; people?:{name:string;role:string}[]; documents?:{name:string;status:string}[]; reportingValueUsd?:number; dataQuality:"verified"|"partial"|"unverified"; }
export interface Relationship { id:string; subjectId:string; type:"OWNS"|"HOLDS"; objectId:string; }
export interface Obligation { id:string; title:string; relatedEntityId:string; status:ObligationStatus; importance:"CRITICAL"|"HIGH"|"NORMAL"|"LOW"; dueAt?:string; nextAction:string; requiresOwnerAttention:boolean; sourceState:"VERIFIED"|"USER_CONFIRMED"|"UNVERIFIED"; }
