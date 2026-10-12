import { passportReadiness, type PassportPlan } from "@/lib/passport-renewal";

export default function PassportReadiness({ plan, today }: { plan: PassportPlan | undefined; today: string }) {
  const readiness = passportReadiness(plan, today);
  return <span className={`vehicleReadiness passportReadiness ${readiness.state}`} title={readiness.detail}>
    <span aria-hidden="true">●</span> {readiness.label}
    <span className="passportCheckScope">· date check</span>
  </span>;
}
