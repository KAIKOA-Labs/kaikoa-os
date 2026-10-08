"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { filterInventory, inventoryCategories, inventoryCategoryLabel, inventoryQualityLabel, type InventoryRecord } from "@/lib/inventory-view";

import { inventorySections, recordsForInventorySection, type InventorySection } from "@/lib/inventory-sections";

type ViewState = "loading" | "ready" | "error" | "signed-out";
export default function InventoryBrowser({ section }: { section: Exclude<InventorySection, "subscriptions"> }) {
  const definition = inventorySections.find(item => item.key === section)!;
  const [stage, setStage] = useState<ViewState>("loading");
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const db = getBrowserSupabase();
      if (!db) { setStage("error"); return; }
      const { data: identity, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !identity.user) { setStage("signed-out"); return; }
      const { data, error } = await db.from("entities")
        .select("id,slug,name,subtype,status,location,data_quality")
        .neq("status", "ARCHIVED").order("name");
      if (!active) return;
      if (error) { setStage("error"); return; }
      setRecords(data ?? []);
      setStage("ready");
    })().catch(() => { if (active) setStage("error"); });
    return () => { active = false; };
  }, []);
  const sectionRecords = recordsForInventorySection(records, section);
  const visible = filterInventory(sectionRecords, query, category);
  const categories = inventoryCategories(sectionRecords);
  function clearFilters() { setQuery(""); setCategory(null); }
  return <main className="shell">
    <header><p className="eyebrow">KAIKOA OS · INVENTORY</p><h1>{definition.title}.</h1>
      <p className="muted">{definition.description}</p></header>
    {stage === "loading" && <p role="status">Loading {definition.title.toLowerCase()}…</p>}
    {stage === "signed-out" && <section className="panel"><p>Sign in to view your {definition.title.toLowerCase()}.</p><Link href="/auth/sign-in">Sign in →</Link></section>}
    {stage === "error" && <section className="panel" role="alert"><h2>Unable to load {definition.title.toLowerCase()}</h2><p>Check your connection and try again.</p></section>}
    {stage === "ready" && <section className="panel">
      <div className="inventoryControls">
        <div><label htmlFor="inventory-search">Search records</label>
          <input id="inventory-search" type="search" maxLength={120} placeholder="Name, category or location" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div><label htmlFor="inventory-category">Category</label>
          <select id="inventory-category" value={category ?? ""} onChange={event => setCategory(event.target.value || null)}>
            <option value="">All categories</option>
            {categories.map(item => <option key={item.key} value={item.key}>{item.label} · {item.count}</option>)}
          </select></div>
      </div>
      <div className="sectionHead"><p className="muted" role="status">Showing {visible.length} of {sectionRecords.length} records</p>
        {(query || category !== null) && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>
      {visible.length === 0 ? <p className="muted">{sectionRecords.length === 0 ? definition.empty : "No records match your search and category. Clear the filters to see this section."}</p> :
        <div className="assetGrid">{visible.map(record => <Link className="asset assetLink" key={record.id} href={"/private-memory/assets/" + encodeURIComponent(record.slug)}>
          <span className="eyebrow">{inventoryCategoryLabel(record.subtype)}</span><strong>{record.name} →</strong>
          <span>{record.status}</span><small>{record.location || "Location not recorded"}</small>
          <small>Data quality: {inventoryQualityLabel(record.data_quality)}</small>
        </Link>)}</div>}
    </section>}
  </main>;
}
