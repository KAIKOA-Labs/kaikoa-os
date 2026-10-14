"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { registryFromMetadata, type PrintRegistry, type PrintRecord } from "@/lib/artwork-print-registry";

const productionLabel: Record<PrintRecord["production"], string> = {
  unknown: "Production unknown", printed_signed: "Printed / signed", framed_boxed: "Framed / boxed"
};
const fulfillmentLabel: Record<PrintRecord["fulfillment"], string> = {
  unknown: "Fulfillment unknown", held: "Held in storage", awaiting_handover: "Awaiting handover", shipped: "Shipped", delivered: "Delivered"
};
function PrintItem({ print, limit }: { print: PrintRecord; limit: number }) {
  return <article className="item">
    <strong>{print.kind === "artist_proof" ? `AP ${print.number}` : `${print.number}/${limit}`}</strong>
    <span className="status">{print.availability.replaceAll("_", " ")}</span>
    <small>{productionLabel[print.production]} · {fulfillmentLabel[print.fulfillment]}</small>
    <small>Location: {print.location ?? "Not verified"}{print.allocation ? ` · Allocated to: ${print.allocation}` : ""}</small>
    <small>Payment: {print.payment.replaceAll("_", " ")} · Source: {print.source_note}</small>
  </article>;
}
export default function ArtworkPrintsPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const generation = useRef(0);
  const [name, setName] = useState("");
  const [registry, setRegistry] = useState<PrintRegistry | null>(null);
  const [state, setState] = useState("Loading physical inventory…");
  useEffect(() => {
    const request = ++generation.current;
    setState("Loading physical inventory…"); setName(""); setRegistry(null);
    (async () => {
      const db = getBrowserSupabase();
      if (!db) throw new Error("Connection unavailable.");
      const { data: auth, error: authError } = await db.auth.getUser();
      if (generation.current !== request) return;
      if (authError || !auth.user) throw new Error("Sign in to view this inventory.");
      const { data, error } = await db.from("entities").select("name,metadata").eq("slug", slug).eq("subtype", "artwork").neq("status", "ARCHIVED").maybeSingle();
      if (generation.current !== request) return;
      if (error || !data) throw new Error("Artwork not found or access denied.");
      const found = registryFromMetadata(data.metadata);
      setName(data.name); setRegistry(found); setState("ready");
    })().catch(error => { if (generation.current === request) setState(error instanceof Error ? error.message : "Unable to load artwork."); });
    return () => { ++generation.current; };
  }, [slug]);
  if (state !== "ready") return <main className="shell"><section className="panel"><p role="status">{state}</p><Link href="/private-memory/artwork">Back to Artwork →</Link></section></main>;
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · ARTWORK · PRIVATE</p><h1>Physical prints.</h1>
      <p>{name}</p><p className="muted">Edition authorization, production, allocation, location, and delivery are separate. Unknown facts never imply physical stock or completed sales.</p></header>
    {!registry ? <section className="panel"><h2>Inventory awaiting reconciliation</h2><p>No individual numbered-print registry has been saved for this artwork. Existing edition details are preserved.</p><p className="muted">Only audited source-backed entries should appear here. A missing record does not mean a print does not exist.</p></section>
      : registry.rules.map(rule => <section className="panel" key={rule.edition_label}>
        <div className="sectionHead"><h2>{rule.edition_label}</h2><span className="status">{rule.reproduction_locked ? "Edition locked · no new prints" : `Edition of ${rule.numbered_limit} · ${rule.artist_proof_limit} AP`}</span></div>
        <p className="muted">Numbered allowance: {rule.numbered_limit} · AP allowance: {rule.artist_proof_limit}. {rule.reproduction_locked ? "Further physical reproductions prohibited." : "Allowances do not certify production."}</p>
        {registry.prints.filter(print => print.edition_label === rule.edition_label).length === 0 ? <p>No individual prints recorded yet.</p> :
          registry.prints.filter(print => print.edition_label === rule.edition_label).sort((a,b) => a.kind.localeCompare(b.kind) || a.number-b.number)
            .map(print => <PrintItem key={print.kind + print.number} print={print} limit={print.kind === "numbered" ? rule.numbered_limit : rule.artist_proof_limit} />)}
      </section>)}
    <p><Link href={"/private-memory/artwork/" + encodeURIComponent(slug) + "/prints/manage"}>Manage physical print records →</Link></p>
    <p><Link href={"/private-memory/artwork/" + encodeURIComponent(slug) + "/editions"}>Edition totals →</Link></p>
    <p><Link href="/private-memory/artwork">Back to Artwork →</Link></p>
  </main>;
}
