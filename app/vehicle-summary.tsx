import { parseVehicleProfile, vehicleBase, vehicleReadiness, vehicleToday } from "@/lib/vehicle-profile";
export default function VehicleSummary({ profile, location, compact = false }: { profile: unknown; location: string | null; compact?: boolean }) {
  const p = parseVehicleProfile(profile), readiness = vehicleReadiness(profile, vehicleToday()), base = vehicleBase(profile, location);
  return <div className="vehicleSummary">
    <div className="vehicleTags"><span className="vehicleTag">{base ? "Base · " + base : "Base not recorded"}</span><span className="vehicleTag vehiclePlate">{p?.registration_plate ? "Plate · " + p.registration_plate : "Plate not recorded"}</span></div>
    <span className={"vehicleReadiness " + readiness.state}><span aria-hidden="true">●</span> {readiness.label}</span>
    {readiness.checks.length > 0 && <ul className="vehicleChecks">{readiness.checks.filter(check => !compact || check.state !== "unknown").map((check, index) => <li className={check.state} key={index}><span aria-hidden="true">{check.state === "good" ? "✓" : check.state === "attention" ? "!" : "—"}</span> {check.label}</li>)}</ul>}
    {p?.checked_on && <small>Owner check · {p.checked_on}</small>}
    {!compact && p && <><p className="muted">{p.serviced_on ? "Last service · " + p.serviced_on : "Last service not recorded"}{p.service_interval === "annual" ? " · Annual" : ""}</p><small>Source: {p.source_note}</small></>}
  </div>;
}
