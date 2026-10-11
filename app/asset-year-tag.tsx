export default function AssetYearTag({ year }: { year?: number | null }) {
  return year ? <span className="vehicleTag">Year · {year}</span> : null;
}
