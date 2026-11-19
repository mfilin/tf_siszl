/*
  Speed up GF queries that join people to result code 207.

  The filtered index keeps only the matching result rows and supports the
  person_id join used by the D05 export and other 207 lookups.
  This migration is intentionally idempotent.
*/
SET QUOTED_IDENTIFIER ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.gf_dn_list_result')
      AND name = N'IX_gf_dn_list_result_207_person_id'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_gf_dn_list_result_207_person_id
        ON dbo.gf_dn_list_result (person_id)
        WHERE DN_LIST_RESULT_CODE = '207';
END;
GO
