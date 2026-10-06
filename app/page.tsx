import { entities, obligations } from "@/lib/seed";

export default function Home() {
  const needsYou = obligations.filter((o) => o.requiresOwnerAttention && o.status !== "COMPLETED");
  const overdue = obligations.filter((o) => o.status === "OVERDUE");
  const waiting = obligations.filter((o) => o.status === "WAITING");
  const upcoming = obligations.filter((o) => o.status === "UPCOMING");

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">KAIKOA OS · MILESTONE 001</p>
        <h1>Good morning, Eddie.</h1>
        <p className="muted">The hull is alive. This screen is generated from structured KAIKOA OS data.</p>
      </header>

      <section className="metrics">
        <Metric label="Requires You" value={needsYou.length} />
        <Metric label="Overdue" value={overdue.length} />
        <Metric label="Waiting On" value={waiting.length} />
        <Metric label="Due Soon" value={upcoming.length} />
      </section>

      <section className="panel">
        <h2>Needs You</h2>
        {needsYou.map((item) => {
          const entity = entities.find((e) => e.id === item.relatedEntityId);
          return (
            <article className="item" key={item.id}>
              <div>
                <strong>{entity?.name}</strong>
                <p>{item.title}</p>
              </div>
              <span className="status">{item.status}</span>
              <small>{item.nextAction}</small>
            </article>
          );
        })}
      </section>

      <section className="panel">
        <h2>Life Inventory · Seed</h2>
        <div className="assetGrid">
          {entities.filter((e) => e.id !== "eduardo").map((entity) => (
            <article className="asset" key={entity.id}>
              <span className="eyebrow">{entity.subtype.replace("_", " ")}</span>
              <strong>{entity.name}</strong>
              <span>{entity.status}</span>
              {entity.location && <small>{entity.location}</small>}
              <small>Data: {entity.dataQuality}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}
