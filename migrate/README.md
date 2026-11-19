# SQL migrations

## Current index inventory

The base inventory below was read from `TF_SISZL` on 2026-10-31. Migrations `001` and `002` were applied on 2026-11-19.

| Table | Existing index | Keys | Included columns |
| --- | --- | --- | --- |
| `gf_person` | `PK__gf_perso__3213E83F8A21DB7C` | `id` | — |
| `gf_person` | `IX_ENP_gf_person` | `ENP` | `id`, `import_id` |
| `gf_dn_list_result` | `PK__gf_dn_li__3213E83F8402E5C5` | `id` | — |
| `gf_dn_list_result` | `IX_gf_dn_list_result` | `person_id` | `DN_LIST_PERIOD_CD`, `DN_LIST_FILENAME`, `CODE_L`, `DN_LIST_RESULT_CODE`, `DN_LIST_DATE_CHEKING`, `DN_LIST_RESULT_DESCR` |
| `gf_dn_plan_result` | `PK__gf_dn_pl__3213E83F2E674E5D` | `id` | — |
| `gf_dn_plan_result` | `IX_person_id` | `person_id` | `CODE_P`, `DN_PLAN_RESULT_CODE` |
| `gf_trigger` | `PK__gf_trigg__3213E83F5B889582` | `id` | — |
| `gf_person` | `IX_gf_person_import_id_ENP_id` | `import_id`, `ENP`, `id` | `DN_PATIENT_ID`, `ATTACH_MCODE` |
| `gf_person` | `IX_gf_person_import_id_ATTACH_MCODE_ENP_id` | `import_id`, `ATTACH_MCODE`, `ENP`, `id` | `DN_PATIENT_ID` |
| `gf_trigger` | `IX_gf_trigger_person_id_id` | `person_id`, `id` | — |
| `gf_dn_list_result` | `IX_gf_dn_list_result_207_person_id` | `person_id` | Filter: `DN_LIST_RESULT_CODE = '207'` |

The main gaps found were an index beginning with `gf_person.import_id` (used to select a GF file) and an index beginning with `gf_trigger.person_id` (used to fetch trigger details). Existing result tables already have indexes beginning with `person_id`.

## Applying a migration

`001_AddGfQueryIndexes.sql` adds indexes for file/ЕНП paging, МО filtering, and trigger lookups. `002_AddGfResult207Index.sql` adds a filtered `person_id` index for result code 207. Both scripts are idempotent and set `QUOTED_IDENTIFIER ON` for SQL Server index creation.

Both migrations have been applied to `TF_SISZL`. Verify the target database before reapplying elsewhere; index creation on the multi-million-row GF tables can take time and use additional disk space.
