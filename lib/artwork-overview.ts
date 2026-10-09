import { copiesStillToPrint, validateInventory } from "./artwork-inventory.ts";

// Read only the artwork-inventory subtree. Unrelated metadata is never needed here.
export function artworkOverview(value: unknown) {
  if (value === null || value === undefined) return { state: "missing" } as const;
  try {
    const inventory = validateInventory(value);
    return {
      state: "recorded" as const,
      editions: inventory.editions.map(edition => ({
        label: edition.label, imageSize: edition.image_size,
        limit: edition.edition_limit, printed: edition.printed_count,
        stillToPrint: copiesStillToPrint(edition),
      })),
      proofs: { allowance: inventory.artist_proofs.allowance, printed: inventory.artist_proofs.printed_count },
    };
  } catch {
    return { state: "needs-review" } as const;
  }
}
