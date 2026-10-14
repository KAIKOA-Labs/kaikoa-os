import { registryFromMetadata, type PrintRegistry } from "./artwork-print-registry";

export type ArtGalleryStats = {
 state: "missing" | "invalid" | "recorded"; registry: PrintRegistry | null;
 versions: number; recorded: number; proofs: number; held: number;
 awaitingHandover: number; delivered: number; sold: number; locked: number;
};
export function artGalleryStats(value: unknown): ArtGalleryStats {
 const empty = (state: "missing" | "invalid"): ArtGalleryStats => ({
   state,registry:null,versions:0,recorded:0,proofs:0,held:0,awaitingHandover:0,delivered:0,sold:0,locked:0
 });
 if (value === undefined || value === null) return empty("missing");
 let registry: PrintRegistry | null;
 try { registry = registryFromMetadata({artwork_print_registry:value}); }
 catch {return empty("invalid");}
 if (!registry) return empty("missing");
 const n = (predicate:(p:PrintRegistry["prints"][number])=>boolean)=>registry.prints.filter(predicate).length;
 return {state:"recorded",registry,versions:registry.rules.length,recorded:registry.prints.length,
 proofs:n(p=>p.kind==="artist_proof"),held:n(p=>p.fulfillment==="held"),
 awaitingHandover:n(p=>p.fulfillment==="awaiting_handover"),
 delivered:n(p=>p.fulfillment==="delivered"),sold:n(p=>p.availability==="sold"),
 locked:registry.rules.filter(r=>r.reproduction_locked).length};
}
