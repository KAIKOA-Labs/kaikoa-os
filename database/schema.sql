-- KAIKOA OS · Milestone 001 conceptual PostgreSQL schema.
-- This is intentionally small. It proves the universal model before expansion.

create table entities (
  id uuid primary key,
  type text not null,
  subtype text,
  name text not null,
  status text not null,
  data_quality text not null default 'unverified',
  location_text text,
  reporting_value_usd numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table relationships (
  id uuid primary key,
  subject_id uuid not null references entities(id),
  relationship_type text not null,
  object_id uuid not null references entities(id),
  valid_from timestamptz,
  valid_to timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table obligations (
  id uuid primary key,
  title text not null,
  related_entity_id uuid references entities(id),
  status text not null,
  importance text not null,
  due_at timestamptz,
  next_attention_at timestamptz,
  next_action text,
  requires_owner_attention boolean not null default false,
  source_state text not null default 'unverified',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
