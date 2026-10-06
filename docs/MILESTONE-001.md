# Milestone 001 — The Hull

## Goal

Prove that KAIKOA OS can represent real life through one universal model and derive a simple Command Center from structured data.

## Seed entities

- Eduardo — Person
- KAIKOA — Asset / Vessel
- Burgos Ocean View — Asset / Property
- kaikoa.com — Asset / Digital Asset
- Spanish Passport — Credential

## Seed relationships

- Eduardo OWNS KAIKOA
- Eduardo OWNS Burgos Ocean View
- Eduardo OWNS kaikoa.com
- Eduardo HOLDS Spanish Passport

## Seed obligations

- Verify kaikoa.com renewal protection
- Reconcile remaining Burgos 2026 payment
- Verify Spanish passport expiry

## Acceptance criteria

1. App starts locally.
2. Home screen is responsive.
3. Command Center counts are derived from structured obligations rather than hard-coded.
4. Seed inventory renders from structured entities.
5. PostgreSQL schema expresses entities, relationships and obligations.
6. No sensitive credentials or secrets are committed.
7. No external write automation exists.
