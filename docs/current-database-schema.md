# Current application database schema

Inspected 2026-10-08. This describes the live schema, including Milestone 005. database/schema.sql remains the original conceptual model.

| Table | Purpose | Current columns |
| --- | --- | --- |
| entities | Universal inventory | id, slug, name, entity_type, subtype, status, location, description, data_quality, metadata, visibility, created_at, updated_at |
| relationships | Typed entity links | id, subject_entity_id, relationship_type, object_entity_id, metadata, created_at |
| obligations | Responsibility and workflow engine | id, related_entity_id, title, status, importance, due_at, next_action, requires_owner_attention, source_state, metadata, visibility, created_at, updated_at, workflow_note, scheduled_at, completed_at |
| documents | Evidence references | id, title, document_type, external_provider, external_ref, source_url, status, metadata, created_at, updated_at |
| document_links | Links evidence to records | id, document_id, entity_id, obligation_id, relationship_type, created_at |
| events | Dated occurrences | id, related_entity_id, event_type, occurred_at, title, description, source_state, metadata, created_at |
| entity_change_history | Inventory audit trail | id, entity_id, changed_by, field_name, previous_value, new_value, changed_at |
| obligation_change_history | Obligation audit trail | id, obligation_id, changed_by, field_name, previous_value, new_value, changed_at |

All IDs are UUIDs; metadata is JSONB; dates are timezone-aware timestamps. Foreign keys connect universal records and evidence. All eight tables retain RLS with fixed-owner SELECT policies. Client table grants are SELECT-only for authenticated users, with no anon table grants. The owner identifier is intentionally omitted from this public documentation.

Owner-authorized RPCs cover asset creation, safe description editing, controlled archiving, obligation creation and safe legacy editing. The new update_obligation_workflow RPC updates only status, next_action, workflow_note, scheduled_at, completed_at, requires_owner_attention and updated_at. It preserves financial metadata, due_at, importance, visibility and source_state.

The private workflow function uses the existing owner identity and an empty search_path. Its public wrapper is SECURITY INVOKER. It validates the expected record version while holding a row lock, and appends changed fields to obligation_change_history in the same transaction.

Repository migrations are incremental against the existing live database, not a complete clean-room restoration set. Do not use the conceptual schema file as a production restore script. Reconstruct and verify a full restoration set only during the isolated recovery milestone.
