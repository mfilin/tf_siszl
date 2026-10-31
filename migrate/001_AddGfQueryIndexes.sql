/*
  Add indexes for GF record paging and record detail lookup.

  This migration is intentionally idempotent. Review during a maintenance window:
  gf_person contains millions of rows, so index creation can take time and use
  additional disk space. This file has been saved but has NOT been applied.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.gf_person')
      AND name = N'IX_gf_person_import_id_ENP_id'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_gf_person_import_id_ENP_id
        ON dbo.gf_person (import_id, ENP, id)
        INCLUDE (DN_PATIENT_ID, ATTACH_MCODE);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.gf_person')
      AND name = N'IX_gf_person_import_id_ATTACH_MCODE_ENP_id'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_gf_person_import_id_ATTACH_MCODE_ENP_id
        ON dbo.gf_person (import_id, ATTACH_MCODE, ENP, id)
        INCLUDE (DN_PATIENT_ID);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.gf_trigger')
      AND name = N'IX_gf_trigger_person_id_id'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_gf_trigger_person_id_id
        ON dbo.gf_trigger (person_id, id);
END;
GO
