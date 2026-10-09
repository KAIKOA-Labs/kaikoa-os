import { artworkOverview } from "@/lib/artwork-overview";

export default function ArtworkEditionOverview({ inventory }: { inventory: unknown }) {
  const overview = artworkOverview(inventory);
  const show = (value: number | null) => value === null ? "Unknown" : value;
  if (overview.state === "missing") return <div className="artworkEditionOverview"><small>Edition information not recorded.</small><small>Printed counts and artist proofs: Unknown.</small></div>;
  if (overview.state === "needs-review") return <div className="artworkEditionOverview"><small>Edition information needs review. No counts are inferred.</small></div>;
  return <div className="artworkEditionOverview">
    <small>Edition versions · {overview.editions.length}</small>
    {overview.editions.length === 0 && <small>No edition versions recorded.</small>}
    {overview.editions.map(edition => <div className="artworkEditionRow" key={edition.label}>
      <strong>{edition.label}</strong>
      {edition.imageSize && <small>Image: {edition.imageSize}</small>}
      <small>Limit: {show(edition.limit)} · Printed: {show(edition.printed)} · Still to print: {show(edition.stillToPrint)}</small>
    </div>)}
    <small>Artist proofs · Allowance: {show(overview.proofs.allowance)} · Printed: {show(overview.proofs.printed)}</small>
    <small>Unverified source information. Still to print is not available-for-sale stock.</small>
  </div>;
}
