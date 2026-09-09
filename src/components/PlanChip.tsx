import { isMember, membershipChip } from "../lib/access";
import type { Entitlement, PlanId } from "../types";

function tierClass(planId: PlanId | null, member: boolean) {
  if (!member || !planId) return "plan-chip plan-chip-free";
  if (planId === "tide") return "plan-chip plan-chip-tide";
  if (planId === "surge") return "plan-chip plan-chip-surge";
  return "plan-chip plan-chip-wave";
}

export function PlanChip({ entitlement }: { entitlement: Entitlement }) {
  const member = isMember(entitlement);
  return <span className={tierClass(entitlement.planId, member)}>{membershipChip(entitlement)}</span>;
}
