# SQL migrations

## Current index inventory

The inventory below was read from `TF_SISZL` on 2026-10-31.

| Table | Existing index | Keys | Included columns |
| --- | --- | --- | --- |
| `gf_person` | `PK__gf_perso__3213E83F8A21DB7C` | `id` | — |
| `gf_person` | `IX_ENP_gf_person` | `ENP` | `id`, `import_id` |
| `gf_dn_list_result` | `PK__gf_dn_li__3213E83F8402E5C5` | `id` | — |
| `gf_dn_list_result` | `IX_gf_dn_list_result` | `person_id` | `DN_LIST_PERIOD_CD`, `DN_LIST_FILENAME`, `CODE_L`, `DN_LIST_RESULT_CODE`, `DN_LIST_DATE_CHEKING`, `DN_LIST_RESULT_DESCR` |
| `gf_dn_plan_result` | `PK__gf_dn_pl__3213E83F2E674E5D` | `id` | — |
| `gf_dn_plan_result` | `IX_person_id` | `person_id` | `CODE_P`, `DN_PLAN_RESULT_CODE` |
| `gf_trigger` | `PK__gf_trigg__3213E83F5B889582` | `id` | — |

The main gaps found were an index beginning with `gf_person.import_id` (used to select a GF file) and an index beginning with `gf_trigger.person_id` (used to fetch trigger details). Existing result tables already have indexes beginning with `person_id`.

## Applying a migration

`001_AddGfQueryIndexes.sql` prepares indexes for file/ЕНП paging, МО filtering, and trigger lookups. It is idempotent but has **not** been applied to the database. Review and run it during a maintenance window: `gf_person` has about 5.9 million rows and `gf_trigger` about 5.3 million rows.
