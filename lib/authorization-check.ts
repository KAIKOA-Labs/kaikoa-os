// This runner uses the browser's real session; it never constructs JWT claims.
export const accessTables = ["entities", "relationships", "obligations", "documents", "document_links", "events", "entity_change_history", "obligation_change_history"] as const;
const absentId = "00000000-0000-4000-8000-000000000006";
// Invalid creation fields and nonexistent IDs provide a second safety boundary.
// Only the owner guard's exact error passes, never input-validation errors.
export const accessWrites = [
  { name: "archive_unverified_asset", args: { p_entity_id: absentId } },
  { name: "archive_unverified_obligation", args: { p_obligation_id: absentId } },
  { name: "create_inventory_asset", args: { p_name: "", p_subtype: "other", p_description: "" } },
  { name: "create_inventory_obligation", args: { p_entity_id: absentId, p_title: "", p_next_action: "", p_requires_owner_attention: false } },
  { name: "update_safe_entity_description", args: { p_entity_id: absentId, p_description: null } },
  { name: "update_safe_obligation_next_action", args: { p_obligation_id: absentId, p_next_action: "" } },
  { name: "update_safe_obligation_status", args: { p_obligation_id: absentId, p_status: "" } },
  { name: "update_obligation_workflow", args: { p_obligation_id: absentId, p_status: "", p_next_action: "", p_workflow_note: "", p_scheduled_at: null, p_confirm_completion: false, p_expected_updated_at: null } },
] as const;
type Identity = { id: string; email?: string };
type Response = { status: number; count?: number | null; error: { code: string; message: string } | null };
export type AccessCheck = { kind: "read" | "write"; name: string; passed: boolean; status: number; detail: string };
export type AccessDriver = {
  identity: () => Promise<Identity | null>;
  read: (table: string) => Promise<Response>;
  write: (name: string, args: Record<string, unknown>) => Promise<Response>;
};
export async function runAccessChecks(driver: AccessDriver, publish: (checks: AccessCheck[]) => void, signal: AbortSignal) {
  const initial = await driver.identity();
  if (signal.aborted) throw new Error("Check cancelled. Start again with the test account.");
  if (!initial?.email?.toLowerCase().includes("+kaikoa-os-test@")) throw new Error("Sign in with the temporary test account before running this check.");
  const sameIdentity = async () => {
    if (signal.aborted) throw new Error("Check cancelled. Start again with the test account.");
    const current = await driver.identity();
    if (signal.aborted || current?.id !== initial.id) throw new Error("Session changed. Results were discarded; start again.");
  };
  const reads = await Promise.all(accessTables.map(async name => {
    const response = await driver.read(name);
    const passed = !response.error && response.status >= 200 && response.status < 300 && response.count === 0;
    return { kind: "read" as const, name, passed, status: response.status, detail: passed ? "0 visible rows" : "Expected a successful query with exactly 0 rows" };
  }));
  await sameIdentity();
  publish([...reads]);
  if (reads.some(check => !check.passed)) throw new Error("Read check failed. No write checks were sent.");
  const checks: AccessCheck[] = [...reads];
  for (const write of accessWrites) {
    await sameIdentity();
    const response = await driver.write(write.name, { ...write.args });
    await sameIdentity();
    const passed = response.error?.message === "Not authorized" &&
      ["P0001", "42501"].includes(response.error.code) && [400, 403].includes(response.status);
    checks.push({ kind: "write", name: write.name, passed, status: response.status, detail: passed ? `Not authorized (${response.error!.code})` : "Expected explicit owner-authorization denial" });
    publish([...checks]);
    if (!passed) throw new Error("Write check failed. Remaining requests stopped; report this result before continuing.");
  }
  return checks;
}
