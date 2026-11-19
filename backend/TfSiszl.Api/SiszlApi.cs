using System.Globalization;
using System.Data;
using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;

internal static class SiszlEndpointMapping
{
    public static void MapSiszlEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1/dn").WithTags("Данные ДН / GF");
        api.MapGet("/files", async (SiszlApi service, [AsParameters] FileQuery query, CancellationToken ct) =>
            Results.Ok(await service.GetFiles(query, ct)))
            .WithSummary("Список файлов")
            .WithDescription("Возвращает файлы обмена с фильтрами, сортировкой и пагинацией.");
        api.MapGet("/files/summary", async (SiszlApi service, [AsParameters] FileQuery query, CancellationToken ct) =>
            Results.Ok(await service.GetFileSummary(query, ct)))
            .WithSummary("Сводка по файлам")
            .WithDescription("Возвращает сводные показатели с учётом фильтров.");
        api.MapGet("/files/{fileId}", async (string fileId, SiszlApi service, CancellationToken ct) =>
        {
            var file = await service.GetFile(fileId, ct);
            return file is null ? Results.NotFound() : Results.Ok(file);
        }).WithSummary("Карточка файла").WithDescription("Возвращает сведения об одном файле по его ID.");
        api.MapGet("/files/{fileId}/records", async (string fileId, SiszlApi service, [AsParameters] RecordQuery query, CancellationToken ct) =>
            await service.GetRecords(fileId, query, ct))
            .WithSummary("Записи файла GF")
            .WithDescription("Возвращает записи выбранного файла с фильтрами и пагинацией.");
        api.MapGet("/files/{fileId}/records/count", async (string fileId, SiszlApi service, [AsParameters] RecordQuery query, CancellationToken ct) =>
            await service.GetRecordCount(fileId, query, ct))
            .WithSummary("Количество записей")
            .WithDescription("Отдельно считает записи файла GF с учётом фильтров.");
        api.MapGet("/files/{fileId}/records/export", async (string fileId, HttpContext context, SiszlApi service, [AsParameters] RecordQuery query, CancellationToken ct) =>
            await service.ExportRecords(fileId, query, context, ct))
            .WithSummary("Выгрузка записей файла")
            .WithDescription("Скачивает записи выбранного файла с учётом фильтров.");
        api.MapGet("/files/{fileId}/export/d05-test", async (string fileId, string? moCode, Guid progressId, HttpContext context, SiszlApi service, IExportProgressStore progress, CancellationToken ct) =>
        {
            progress.Start(progressId, "Подготовка выборки");
            try
            {
                var result = await service.ExportD05Test(fileId, moCode, progressId, context, ct);
                progress.Complete(progressId, "Выгрузка завершена");
                return result;
            }
            catch (Exception ex)
            {
                progress.Fail(progressId, "Ошибка выгрузки", ex.Message);
                throw;
            }
        })
            .WithSummary("Тестовая выгрузка D05")
            .WithDescription("Формирует тестовые ZIP-пакеты D05 по МО для выбранного GF; ФИО синтетические.");
        api.MapGet("/files/export/d05-test-progress/{progressId:guid}", (Guid progressId, IExportProgressStore progress) =>
                progress.Get(progressId) is { } status ? Results.Ok(status) : Results.NotFound())
            .WithSummary("Прогресс D05")
            .WithDescription("Возвращает число сформированных файлов по МО.");        api.MapGet("/files/export/by-mo", async (HttpContext context, SiszlApi service, [AsParameters] MoGroupExportQuery query, CancellationToken ct) =>
            await service.ExportByMedicalOrganization(query, context, ct))
            .WithSummary("Выгрузка по МО")
            .WithDescription("Скачивает архив с отдельным файлом записей для каждой МО.");
        api.MapGet("/files/{fileId}/records/{recordKey}", async (string fileId, string recordKey, SiszlApi service, CancellationToken ct) =>
        {
            var record = await service.GetRecord(fileId, recordKey, ct);
            return record is null ? Results.NotFound() : Results.Ok(record);
        }).WithSummary("Запись GF").WithDescription("Возвращает одну запись по ключу в выбранном файле.");
        api.MapGet("/files/{fileId}/analytics", async (string fileId, int? repeatPeriods, int? top, SiszlApi service, CancellationToken ct) =>
        {
            if (repeatPeriods is < 2 or > 24 || top is < 1 or > 20) return Results.BadRequest(new { error = new { code = "INVALID_PARAMETERS", message = "repeatPeriods должен быть от 2 до 24, top — от 1 до 20." } });
            return await service.GetAnalytics(fileId, repeatPeriods ?? 2, top ?? 6, ct);
        }).WithSummary("Аналитика файла").WithDescription("Возвращает аналитику ошибок и повторов за заданное число периодов.");
        api.MapGet("/dictionaries/result-codes", async (SiszlApi service, CancellationToken ct) => Results.Ok(await service.GetResultCodes(ct)))
            .WithSummary("Статусы записей")
            .WithDescription("Возвращает справочник кодов результатов обработки записей.");
        api.MapGet("/dictionaries/diagnoses", () =>
        {
            var path = Path.Combine(AppContext.BaseDirectory, "diagnoses.json");
            return File.Exists(path)
                ? Results.Content(File.ReadAllText(path, Encoding.UTF8), "application/json; charset=utf-8")
                : Results.Problem("Справочник диагнозов не найден.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }).WithSummary("Диагнозы").WithDescription("Возвращает справочник диагнозов.");
    }
}

internal sealed record FileQuery(string? Q, string? Type, string? PeriodFrom, string? PeriodTo, string? Status, string? Direction, int Page = 1, int PageSize = 25, string? Sort = null);
internal sealed record RecordQuery(string? Q, string? Category, int? ResultCode, string? MoCode, int Page = 1, int PageSize = 25, string? Sort = null);
internal sealed record MoGroupExportQuery(string? ResultType, string? ResultCode, string? FileId, string? MoCode);
internal sealed class FileDto
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Period { get; set; } = "";
    public string Direction { get; set; } = "";
    public int? RecordCount { get; set; }
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public long? FileSizeBytes { get; set; }
    public string? SourceFileName { get; set; }
    public object? Error { get; set; }
    public string? Checksum { get; set; }
    public DateTime? ProcessingStartedAt { get; set; }
    public DateTime? ProcessingFinishedAt { get; set; }
}
internal sealed record FilePage(IReadOnlyList<FileDto> Items, int Page, int PageSize, int TotalItems, int TotalPages);
internal sealed record FileSummary(int TotalFiles, int OutboundGstGpt, int InboundGf, int FailedFiles, DateTime AsOf);
internal sealed record ResultCodeDto(object Code, string Description, string Category, string? Recommendation);
internal sealed record ResultDictionaries(IReadOnlyList<ResultCodeDto> Gst, IReadOnlyList<ResultCodeDto> Gpt);
internal sealed record ResultBranchDto(string? Period, string? FileName, string? Code, object? ResultCode, string? ResultDate, string? ResultDescription);
internal sealed record PatientDto(int? SexCode, string? BirthDate, string? SmoCode, string? AttachMoCode, string? AttachDate, string? SmoRegionCode);
internal sealed record RecordDto(string Id, string? Enp, string? DnPatientId, string? DiagnosisCode, int? GroupRhCode, string? GroupRhProfile, string? GroupRhName, string? DnRuleInName, PatientDto Patient, ResultBranchDto? DnList, ResultBranchDto? DnPlan, DateTime? InsertedAt, DateTime? UpdatedAt, string? MoCode, object? GisEvidence = null);
internal sealed record RecordPage(string FileId, string FileName, IReadOnlyList<RecordDto> Items, int Page, int PageSize, bool HasMore);
internal sealed record D05TaskData(int Zap, string TaskId, string Enp, string? DnPatientId, string Surname, string Name, string Patronymic, DateTime Birthday, int Sex, int GroupRhCode, string GroupRhName, string DiagnosisCode, string? GroupRhProfile, int? DoctorType, DateTime? TriggerDate, DateTime? TriggerInvoiceDate, string? TriggerDiagnosisCode, string? TriggerMoCode, string? TriggerHistoryNumber, string? TriggerCaseId);
internal sealed record D05Header(string MoCode, string Name, string SourceGfName, int Year, int Month, DateTime CreatedDate, DateTime Deadline, string PackNumber, int TaskCount);

internal sealed class SiszlApi(SqlConnectionFactory connectionFactory, DatabaseOptions databaseOptions, IExportProgressStore progressStore)
{
    private const string FileCte = """
        WITH files AS (
          SELECT CONCAT('gf-', i.id) AS id, 'GF' AS type, i.filename AS fileName,
            CASE WHEN LEN(i.period) = 6 THEN CONCAT(LEFT(i.period,4),'-',RIGHT(i.period,2)) ELSE i.period END AS period,
            'inbound' AS direction, i.records_count AS recordCount,
            CASE WHEN LOWER(i.status) IN (N'разобран',N'обработан',N'processed') THEN 'processed'
                 WHEN LOWER(i.status) IN (N'в работе',N'обрабатывается',N'processing') THEN 'processing'
                 WHEN LOWER(i.status) LIKE N'%ошиб%' OR LOWER(i.status) LIKE '%fail%' THEN 'failed'
                 ELSE 'queued' END AS status,
            i.import_dttm AS createdAt, CAST(NULL AS bigint) AS fileSizeBytes,
            CAST(NULL AS nvarchar(510)) AS sourceFileName,
            CAST(NULL AS nvarchar(30)) AS sourceStatus, i.id AS sourceId
          FROM dbo.file_import_log i WHERE i.region_cd=@RegionCode
          UNION ALL
          SELECT CONCAT('ex-', e.id), e.file_type, e.filename,
            CASE WHEN LEN(e.period_yymm) = 4 THEN CONCAT('20',LEFT(e.period_yymm,2),'-',RIGHT(e.period_yymm,2)) ELSE e.period_yymm END,
            'outbound', e.records_count,
            CASE WHEN LOWER(e.status) LIKE N'%ошиб%' OR LOWER(e.status) LIKE '%fail%' THEN 'failed'
                 WHEN LOWER(e.status) IN (N'отправлен',N'sent') THEN 'sent'
                 WHEN LOWER(e.status) IN (N'в работе',N'processing') THEN 'processing' ELSE 'processed' END,
            e.created_at, CAST(NULL AS bigint), e.zip_filename, e.status, e.id
          FROM dbo.file_export_log e WHERE e.region_cd=@RegionCode
        )
        """;

    private SqlConnection OpenConnection() => connectionFactory.CreateConnection();

    public async Task<FilePage> GetFiles(FileQuery query, CancellationToken ct)
    {
        if (query.Page < 1 || query.PageSize is < 1 or > 100) throw new BadHttpRequestException("page должен быть больше 0, pageSize — от 1 до 100.");
        ValidateFileFilters(query);
        var (where, parameters) = FileFilters(query);
        var sort = query.Sort?.ToLowerInvariant() switch
        {
            "period:asc" => "period ASC, createdAt DESC",
            "period:desc" or "period" => "period DESC, createdAt DESC",
            "type:asc" => "type ASC, createdAt DESC",
            "type:desc" => "type DESC, createdAt DESC",
            "status:asc" => "status ASC, createdAt DESC",
            "status:desc" => "status DESC, createdAt DESC",
            "recordcount:asc" => "recordCount ASC, createdAt DESC",
            "recordcount:desc" => "recordCount DESC, createdAt DESC",
            "createdat:asc" => "createdAt ASC",
            _ => "createdAt DESC"
        };
        parameters.Add("Offset", (query.Page - 1) * query.PageSize);
        parameters.Add("PageSize", query.PageSize);
        await using var connection = OpenConnection();
        var total = await connection.ExecuteScalarAsync<int>(new CommandDefinition($"{FileCte} SELECT COUNT(1) FROM files {where};", parameters, cancellationToken: ct));
        var items = (await connection.QueryAsync<FileDto>(new CommandDefinition($"{FileCte} SELECT id, type, fileName, period, direction, recordCount, status, createdAt, fileSizeBytes, sourceFileName, CAST(NULL AS nvarchar(1)) AS [Error] FROM files {where} ORDER BY {sort} OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;", parameters, cancellationToken: ct))).AsList();
        return new FilePage(items, query.Page, query.PageSize, total, Math.Max(1, (int)Math.Ceiling(total / (double)query.PageSize)));
    }

    public async Task<FileDto?> GetFile(string fileId, CancellationToken ct)
    {
        await using var connection = OpenConnection();
        return await connection.QuerySingleOrDefaultAsync<FileDto>(new CommandDefinition($"{FileCte} SELECT id, type, fileName, period, direction, recordCount, status, createdAt, fileSizeBytes, sourceFileName, CAST(NULL AS nvarchar(1)) AS [Error], CAST(NULL AS nvarchar(200)) AS checksum FROM files WHERE id=@Id;", new { Id = fileId, RegionCode = databaseOptions.RegionCode }, cancellationToken: ct));
    }

    public async Task<FileSummary> GetFileSummary(FileQuery query, CancellationToken ct)
    {
        ValidateFileFilters(query);
        var (where, parameters) = FileFilters(query, includeQuery: false, includeDirection: false);
        await using var connection = OpenConnection();
        var rows = await connection.QuerySingleAsync<SummaryDb>(new CommandDefinition($"{FileCte} SELECT COUNT(*) totalFiles, COALESCE(SUM(CASE WHEN direction='outbound' THEN 1 ELSE 0 END),0) outboundGstGpt, COALESCE(SUM(CASE WHEN type='GF' THEN 1 ELSE 0 END),0) inboundGf, COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END),0) failedFiles, MAX(createdAt) asOf FROM files {where};", parameters, cancellationToken: ct));
        return new FileSummary(rows.TotalFiles, rows.OutboundGstGpt, rows.InboundGf, rows.FailedFiles, rows.AsOf ?? DateTime.UtcNow);
    }

    public async Task<IResult> GetRecords(string fileId, RecordQuery query, CancellationToken ct)
    {
        if (query.Page < 1 || query.PageSize is < 1 or > 100) return Results.BadRequest(new { error = new { code = "INVALID_PAGINATION", message = "page должен быть больше 0, pageSize — от 1 до 100." } });
        var file = await GetFile(fileId, ct);
        if (file is null) return Results.NotFound();
        if (file.Type != "GF") return Results.Conflict(new { error = new { code = "FILE_TYPE_NOT_SUPPORTED", message = "Строки доступны только для файлов GF." } });
        var (where, parameters) = RecordFilters(query);
        parameters.Add("ImportId", ParseFileId(fileId, "gf-"));
        parameters.Add("Offset", (query.Page - 1) * query.PageSize);
        parameters.Add("FetchSize", query.PageSize + 1);
        var sql = $"""
            SELECT p.id AS Id, p.ENP AS Enp, p.DN_PATIENT_ID AS DnPatientId, p.GROUP_RH_DS AS DiagnosisCode, p.GROUP_RH_CD AS GroupRhCode, p.GROUP_RH_PROFILE AS GroupRhProfile, p.GROUP_RH_NAME AS GroupRhName, p.DN_RULE_IN_NAME AS DnRuleInName,
              p.W AS SexCode, p.DR AS BirthDate, p.SMO AS SmoCode, p.ATTACH_MCODE AS AttachMoCode, p.ATTACH_DATE AS AttachDate, p.SMO_REGION_CD AS SmoRegionCode,
              l.DN_LIST_PERIOD_CD AS ListPeriod, l.DN_LIST_FILENAME AS ListFileName, l.CODE_L AS CodeL, l.DN_LIST_RESULT_CODE AS ListResultCode, l.DN_LIST_DATE_CHEKING AS ListResultDate, l.DN_LIST_RESULT_DESCR AS ListDescription,
              g.DN_PLAN_PERIOD AS PlanPeriod, g.DN_PLAN_FILENAME AS PlanFileName, g.CODE_P AS CodeP, g.DN_PLAN_RESULT_CODE AS PlanResultCode, g.DN_PLAN_DATE_CHEKING AS PlanResultDate, g.DN_PLAN_RESULT_DESCR AS PlanDescription,
              p.INSERT_DTTM AS InsertedAt, p.UPDATE_DTTM AS UpdatedAt, p.ATTACH_MCODE AS MoCode
            FROM dbo.gf_person p LEFT JOIN dbo.gf_dn_list_result l ON l.person_id=p.id LEFT JOIN dbo.gf_dn_plan_result g ON g.person_id=p.id
            WHERE p.import_id=@ImportId {where}
            """;
        await using var connection = OpenConnection();
        var sort = query.Sort?.ToLowerInvariant() switch { "enp:desc" => "Enp DESC", "resultdate:desc" => "COALESCE(ListResultDate,PlanResultDate) DESC, Id", _ => "Enp ASC, Id ASC" };
        var pageRows = (await connection.QueryAsync<RecordDb>(new CommandDefinition($"SELECT * FROM ({sql}) q ORDER BY {sort} OFFSET @Offset ROWS FETCH NEXT @FetchSize ROWS ONLY;", parameters, commandTimeout: 120, cancellationToken: ct))).AsList();
        var hasMore = pageRows.Count > query.PageSize;
        if (hasMore) pageRows.RemoveAt(pageRows.Count - 1);
        var items = pageRows.Select(row => ToRecord(row)).ToList();
        return Results.Ok(new RecordPage(file.Id, file.FileName, items, query.Page, query.PageSize, hasMore));
    }

    public async Task<IResult> GetRecordCount(string fileId, RecordQuery query, CancellationToken ct)
    {
        var file = await GetFile(fileId, ct);
        if (file is null) return Results.NotFound();
        if (file.Type != "GF") return Results.Conflict(new { error = new { code = "FILE_TYPE_NOT_SUPPORTED", message = "Строки доступны только для файлов GF." } });
        var (where, parameters) = RecordFilters(query);
        parameters.Add("ImportId", ParseFileId(fileId, "gf-"));
        const string sql = """
            SELECT COUNT_BIG(1)
            FROM dbo.gf_person p
            LEFT JOIN dbo.gf_dn_list_result l ON l.person_id=p.id
            LEFT JOIN dbo.gf_dn_plan_result g ON g.person_id=p.id
            WHERE p.import_id=@ImportId
            """;
        await using var connection = OpenConnection();
        var count = await connection.ExecuteScalarAsync<long>(new CommandDefinition($"{sql} {where};", parameters, commandTimeout: 120, cancellationToken: ct));
        return Results.Ok(new { fileId = file.Id, fileName = file.FileName, count });
    }

    public async Task<IResult> GetRecord(string fileId, string recordKey, CancellationToken ct)
    {
        var file = await GetFile(fileId, ct);
        if (file is null) return Results.NotFound();
        if (file.Type != "GF") return Results.Conflict(new { error = new { code = "FILE_TYPE_NOT_SUPPORTED", message = "Строки доступны только для файлов GF." } });
        if (!long.TryParse(recordKey, out var id)) return Results.NotFound();
        const string sql = """
            SELECT p.id AS Id, p.ENP AS Enp, p.DN_PATIENT_ID AS DnPatientId, p.GROUP_RH_DS AS DiagnosisCode, p.GROUP_RH_CD AS GroupRhCode, p.GROUP_RH_PROFILE AS GroupRhProfile, p.GROUP_RH_NAME AS GroupRhName, p.DN_RULE_IN_NAME AS DnRuleInName,
              p.W AS SexCode, p.DR AS BirthDate, p.SMO AS SmoCode, p.ATTACH_MCODE AS AttachMoCode, p.ATTACH_DATE AS AttachDate, p.SMO_REGION_CD AS SmoRegionCode,
              l.DN_LIST_PERIOD_CD AS ListPeriod, l.DN_LIST_FILENAME AS ListFileName, l.CODE_L AS CodeL, l.DN_LIST_RESULT_CODE AS ListResultCode, l.DN_LIST_DATE_CHEKING AS ListResultDate, l.DN_LIST_RESULT_DESCR AS ListDescription,
              g.DN_PLAN_PERIOD AS PlanPeriod, g.DN_PLAN_FILENAME AS PlanFileName, g.CODE_P AS CodeP, g.DN_PLAN_RESULT_CODE AS PlanResultCode, g.DN_PLAN_DATE_CHEKING AS PlanResultDate, g.DN_PLAN_RESULT_DESCR AS PlanDescription,
              p.INSERT_DTTM AS InsertedAt, p.UPDATE_DTTM AS UpdatedAt, p.ATTACH_MCODE AS MoCode,
              t.TRIGGER_SCHET_FILENAME AS TriggerFileName, t.TRIGGER_SCHET_CODE AS TriggerCode, t.TRIGGER_NSCHET AS TriggerInvoiceNumber, t.TRIGGER_DSCHET AS TriggerInvoiceDate,
              t.TRIGGER_IDCASE AS TriggerCaseId, t.TRIGGER_SL_ID AS TriggerServiceId, t.TRIGGER_SL_NHISTORY AS TriggerHistoryNumber, t.TRIGGER_DS_CD AS TriggerDiagnosisCode, t.TRIGGER_MCODE AS TriggerMoCode, t.TRIGGER_DT AS TriggerDate
            FROM dbo.gf_person p LEFT JOIN dbo.gf_dn_list_result l ON l.person_id=p.id LEFT JOIN dbo.gf_dn_plan_result g ON g.person_id=p.id
            OUTER APPLY (SELECT TOP(1) * FROM dbo.gf_trigger WHERE person_id=p.id ORDER BY id) t WHERE p.id=@Id AND p.import_id=@ImportId;
            """;
        await using var connection = OpenConnection();
        var row = await connection.QuerySingleOrDefaultAsync<RecordDb>(new CommandDefinition(sql, new { Id = id, ImportId = ParseFileId(fileId, "gf-") }, cancellationToken: ct));
        return row is null ? Results.NotFound() : Results.Ok(ToRecord(row, new { fileName = row.TriggerFileName, code = row.TriggerCode, invoiceNumber = row.TriggerInvoiceNumber, invoiceDate = row.TriggerInvoiceDate, caseId = row.TriggerCaseId, serviceId = row.TriggerServiceId, historyNumber = row.TriggerHistoryNumber, diagnosisCode = row.TriggerDiagnosisCode, moCode = row.TriggerMoCode, date = row.TriggerDate }));
    }

    public async Task<IResult> ExportRecords(string fileId, RecordQuery query, HttpContext context, CancellationToken ct)
    {
        var file = await GetFile(fileId, ct);
        if (file is null) return Results.NotFound();
        if (file.Type != "GF") return Results.Conflict(new { error = new { code = "FILE_TYPE_NOT_SUPPORTED", message = "Экспорт строк доступен только для файлов GF." } });
        var (where, parameters) = RecordFilters(query);
        parameters.Add("ImportId", ParseFileId(fileId, "gf-"));
        const string sql = """
            SELECT p.ENP, p.DN_PATIENT_ID, p.GROUP_RH_DS AS DIAG_CODE, l.CODE_L, l.DN_LIST_RESULT_CODE, g.CODE_P, g.DN_PLAN_RESULT_CODE
            FROM dbo.gf_person p LEFT JOIN dbo.gf_dn_list_result l ON l.person_id=p.id LEFT JOIN dbo.gf_dn_plan_result g ON g.person_id=p.id
            WHERE p.import_id=@ImportId
            """;
        context.Response.ContentType = "text/csv; charset=utf-8";
        context.Response.Headers.ContentDisposition = $"attachment; filename=\"{Path.GetFileNameWithoutExtension(file.FileName)}_filtered.csv\"";
        await using var connection = OpenConnection();
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand(sql + " " + where + " ORDER BY p.ENP, p.id", connection);
        command.CommandTimeout = 120;
        AddParameters(command, parameters);
        await using var reader = await command.ExecuteReaderAsync(System.Data.CommandBehavior.SequentialAccess, ct);
        await using var writer = new StreamWriter(context.Response.Body, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), leaveOpen: true);
        await writer.WriteLineAsync("ENP;DN_PATIENT_ID;DIAG_CODE;CODE_L;DN_LIST_RESULT_CODE;CODE_P;DN_PLAN_RESULT_CODE".AsMemory(), ct);
        while (await reader.ReadAsync(ct))
        {
            var fields = Enumerable.Range(0, reader.FieldCount).Select(i => reader.IsDBNull(i) ? "" : Csv(reader.GetValue(i).ToString() ?? ""));
            await writer.WriteLineAsync(string.Join(";", fields).AsMemory(), ct);
        }
        await writer.FlushAsync(ct);
        return Results.Empty;
    }

    public async Task<IResult> ExportByMedicalOrganization(MoGroupExportQuery query, HttpContext context, CancellationToken ct)
    {
        var resultType = query.ResultType?.Trim().ToUpperInvariant();
        var resultCode = query.ResultCode?.Trim();
        var fileId = query.FileId?.Trim();
        if (resultType is not ("GST" or "GPT") || string.IsNullOrWhiteSpace(resultCode) || !int.TryParse(resultCode, out var numericCode)
            || (resultType == "GST" && numericCode is < 201 or > 299) || (resultType == "GPT" && numericCode is < 301 or > 399))
            return Results.BadRequest(new { error = new { code = "INVALID_RESULT_STATUS", message = "Укажите ветвь GST/GPT и код результата из диапазона этой ветви." } });
        if (string.IsNullOrWhiteSpace(fileId))
            return Results.BadRequest(new { error = new { code = "GF_FILE_REQUIRED", message = "Выберите файл GF для анализа." } });

        var parameters = new DynamicParameters();
        parameters.Add("RegionCode", databaseOptions.RegionCode);
        parameters.Add("ResultCode", resultCode, DbType.AnsiString, size: 20);
        parameters.Add("FileId", fileId, DbType.AnsiString, size: 100);
        var resultFilter = resultType == "GST"
            ? "l.DN_LIST_RESULT_CODE=@ResultCode"
            : "CONVERT(varchar(20),g.DN_PLAN_RESULT_CODE)=@ResultCode";
        var moFilter = string.Empty;
        if (!string.IsNullOrWhiteSpace(query.MoCode))
        {
            moFilter = " AND p.ATTACH_MCODE=@MoCode";
            parameters.Add("MoCode", query.MoCode.Trim(), DbType.AnsiString, size: 50);
        }

        const string sql = """
            SELECT p.ATTACH_MCODE AS MoCode, f.id AS FileId, f.fileName AS FileName, f.period AS Period, f.status AS FileStatus,
              p.ENP AS Enp, p.DN_PATIENT_ID AS DnPatientId, p.GROUP_RH_DS AS DiagnosisCode,
              l.CODE_L AS CodeL, l.DN_LIST_RESULT_CODE AS ListResultCode,
              g.CODE_P AS CodeP, g.DN_PLAN_RESULT_CODE AS PlanResultCode
            FROM files f
            JOIN dbo.gf_person p ON p.import_id=f.sourceId
            LEFT JOIN dbo.gf_dn_list_result l ON l.person_id=p.id
            LEFT JOIN dbo.gf_dn_plan_result g ON g.person_id=p.id
            """;

        await using var connection = OpenConnection();
        await connection.OpenAsync(ct);
        var selectedFileType = await connection.QuerySingleOrDefaultAsync<string>(new CommandDefinition(
            $"{FileCte} SELECT type FROM files WHERE id=@FileId;",
            new { RegionCode = databaseOptions.RegionCode, FileId = fileId }, cancellationToken: ct));
        if (selectedFileType is null) return Results.NotFound(new { error = new { code = "GF_FILE_NOT_FOUND", message = "Файл GF не найден." } });
        if (selectedFileType != "GF") return Results.BadRequest(new { error = new { code = "GF_FILE_REQUIRED", message = "Для анализа можно выбрать только файл GF." } });

        context.Response.ContentType = "application/zip";
        context.Response.Headers.ContentDisposition = $"attachment; filename=\"gf_by_mo_{resultType}_{numericCode}.zip\"";
        await using var command = new SqlCommand($"{FileCte} {sql} WHERE f.type='GF' AND f.id=@FileId AND {resultFilter}{moFilter} ORDER BY p.ATTACH_MCODE, f.fileName, p.ENP, p.id", connection)
        {
            CommandTimeout = 120
        };
        AddParameters(command, parameters);
        await using var reader = await command.ExecuteReaderAsync(System.Data.CommandBehavior.SequentialAccess, ct);
        using var responseStream = new AsyncResponseStream(context.Response.Body);
        using var archive = new System.IO.Compression.ZipArchive(responseStream, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true);
        StreamWriter? writer = null;
        string? currentMoCode = null;
        while (await reader.ReadAsync(ct))
        {
            var moValue = reader.IsDBNull(0) ? null : reader.GetValue(0).ToString();
            var moCode = string.IsNullOrWhiteSpace(moValue) ? "UNKNOWN" : moValue;
            if (!string.Equals(currentMoCode, moCode, StringComparison.Ordinal))
            {
                if (writer is not null)
                {
                    await writer.FlushAsync(ct);
                    await writer.DisposeAsync();
                }

                currentMoCode = moCode;
                var safeMoCode = new string(moCode.Select(ch => char.IsAsciiLetterOrDigit(ch) || ch is '-' or '_' ? ch : '_').ToArray());
                var entry = archive.CreateEntry($"MO_{safeMoCode}.csv", System.IO.Compression.CompressionLevel.Fastest);
                writer = new StreamWriter(entry.Open(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
                await writer.WriteLineAsync("MO_CODE;FILE_ID;FILE_NAME;PERIOD;FILE_STATUS;ENP;DN_PATIENT_ID;DIAG_CODE;CODE_L;DN_LIST_RESULT_CODE;CODE_P;DN_PLAN_RESULT_CODE".AsMemory(), ct);
            }

            var fields = new string[reader.FieldCount];
            fields[0] = moValue is null ? "" : Csv(moValue);
            for (var i = 1; i < reader.FieldCount; i++)
                fields[i] = reader.IsDBNull(i) ? "" : Csv(reader.GetValue(i).ToString() ?? "");
            await writer!.WriteLineAsync(string.Join(";", fields).AsMemory(), ct);
        }
        if (writer is not null)
        {
            await writer.FlushAsync(ct);
            await writer.DisposeAsync();
        }
        await context.Response.Body.FlushAsync(ct);
        return Results.Empty;
    }

    public async Task<IResult> ExportD05Test(string fileId, string? moCode, Guid progressId, HttpContext context, CancellationToken ct)
    {
        var file = await GetFile(fileId, ct);
        if (file is null) return Results.NotFound();
        if (file.Type != "GF") return Results.Conflict(new { error = new { code = "FILE_TYPE_NOT_SUPPORTED", message = "Пакет D05 формируется по файлу GF." } });
        if (!DateTime.TryParseExact(file.Period, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var sourcePeriod))
            return Results.Conflict(new { error = new { code = "INVALID_GF_PERIOD", message = "У файла GF должен быть период в формате ГГГГ-ММ." } });

        var importId = ParseFileId(fileId, "gf-");
        var requestedMo = string.IsNullOrWhiteSpace(moCode) ? null : moCode.Trim();
        await using var connection = OpenConnection();
        await connection.OpenAsync(ct);
        const string createTempSql = """
            CREATE TABLE #d05 (
                Skip tinyint NOT NULL,
                SkipReason nvarchar(64) NULL,
                Id bigint NOT NULL,
                MoCode varchar(20) NULL,
                Enp varchar(16) NULL,
                DnPatientId varchar(100) NULL,
                SexCode int NULL,
                BirthDate date NULL,
                GroupRhCode int NULL,
                DiagnosisCode varchar(10) NULL,
                GroupRhProfile varchar(1000) NULL,
                DoctorType int NULL,
                TriggerDate date NULL,
                TriggerInvoiceDate date NULL,
                TriggerDiagnosisCode nvarchar(20) NULL,
                TriggerMoCode nvarchar(40) NULL,
                TriggerHistoryNumber nvarchar(100) NULL,
                TriggerCaseId nvarchar(100) NULL
            );
            CREATE CLUSTERED INDEX CX_d05_Skip_MoCode_Enp_GroupRhCode_Id
                ON #d05 (Skip, MoCode, Enp, GroupRhCode, Id);
            """;
        await using (var createCommand = new SqlCommand(createTempSql, connection))
            await createCommand.ExecuteNonQueryAsync(ct);

        var moCondition = requestedMo is null ? string.Empty : " AND p.ATTACH_MCODE=@MoCode";
        var populateTempSql = """
            WITH candidates AS (
                SELECT CONVERT(bigint, p.id) AS Id, p.ATTACH_MCODE AS MoCode, p.ENP AS Enp,
                    p.DN_PATIENT_ID AS DnPatientId, p.W AS SexCode, p.DR AS BirthDate,
                    p.GROUP_RH_CD AS GroupRhCode, p.GROUP_RH_DS AS DiagnosisCode,
                    p.GROUP_RH_PROFILE AS GroupRhProfile, p.DN_PRVS AS DoctorType,
                    ROW_NUMBER() OVER (PARTITION BY p.ENP, p.GROUP_RH_CD ORDER BY p.id) AS DuplicateNumber
                FROM dbo.gf_person p
                INNER JOIN dbo.gf_dn_list_result l WITH (INDEX(IX_gf_dn_list_result_207_person_id))
                    ON l.person_id=p.id AND l.DN_LIST_RESULT_CODE='207'
                WHERE p.import_id=@ImportId
                  AND LTRIM(RTRIM(p.ATTACH_MCODE)) LIKE '34%'
            """ + moCondition + """
            )
            INSERT INTO #d05 (
                Skip, SkipReason, Id, MoCode, Enp, DnPatientId, SexCode, BirthDate,
                GroupRhCode, DiagnosisCode, GroupRhProfile, DoctorType,
                TriggerDate, TriggerInvoiceDate, TriggerDiagnosisCode, TriggerMoCode,
                TriggerHistoryNumber, TriggerCaseId)
            SELECT
                CASE WHEN c.DuplicateNumber>1 THEN 2 WHEN reasons.SkipReason IS NULL THEN 0 ELSE 1 END,
                CASE WHEN c.DuplicateNumber>1 THEN NULL ELSE reasons.SkipReason END,
                c.Id, c.MoCode, c.Enp, c.DnPatientId, c.SexCode, c.BirthDate,
                c.GroupRhCode, c.DiagnosisCode, c.GroupRhProfile, c.DoctorType,
                t.TRIGGER_DT, t.TRIGGER_DSCHET, t.TRIGGER_DS_CD, t.TRIGGER_MCODE,
                t.TRIGGER_SL_NHISTORY, t.TRIGGER_IDCASE
            FROM candidates c
            OUTER APPLY (
                SELECT TOP (1) tr.*
                FROM dbo.gf_trigger tr
                WHERE tr.person_id=c.Id AND c.DuplicateNumber=1
                ORDER BY tr.id
            ) t
            CROSS APPLY (SELECT
                CASE
                    WHEN c.DuplicateNumber>1 THEN NULL
                    WHEN c.MoCode IS NULL OR LEN(LTRIM(RTRIM(c.MoCode)))=0 THEN N'нет ATTACH_MCODE'
                    WHEN LEN(LTRIM(RTRIM(c.MoCode)))>6 THEN N'ATTACH_MCODE длиннее 6 знаков'
                    WHEN c.Enp IS NULL OR LEN(LTRIM(RTRIM(c.Enp))) NOT BETWEEN 1 AND 16 THEN N'нет корректного ЕНП'
                    WHEN c.BirthDate IS NULL THEN N'нет даты рождения'
                    WHEN c.SexCode IS NULL OR c.SexCode NOT IN (1,2) THEN N'пол не равен 1 или 2'
                    WHEN c.GroupRhCode IS NULL OR c.GroupRhCode NOT BETWEEN 0 AND 999 THEN N'нет корректного GROUP_RH_CD'
                    WHEN c.DiagnosisCode IS NULL OR LEN(LTRIM(RTRIM(c.DiagnosisCode))) NOT BETWEEN 1 AND 6 THEN N'нет корректного GROUP_RH_DS'
                    ELSE NULL
                END AS SkipReason) reasons;
            """;
        await using (var populateCommand = new SqlCommand(populateTempSql, connection) { CommandTimeout = 300 })
        {
            populateCommand.Parameters.Add("@ImportId", SqlDbType.BigInt).Value = importId;
            if (requestedMo is not null)
                populateCommand.Parameters.Add("@MoCode", SqlDbType.VarChar, 20).Value = requestedMo;
            await populateCommand.ExecuteNonQueryAsync(ct);
        }

        var skipped = new Dictionary<string, int>(StringComparer.Ordinal);
        var duplicateCount = 0L;
        var candidateCount = 0L;
        var fileCount = 0;
        const string summarySql = """
            SELECT Skip, SkipReason, COUNT_BIG(*) AS CandidateRows,
                COUNT(DISTINCT CASE WHEN Skip=0 THEN MoCode END) AS MoCount
            FROM #d05
            GROUP BY Skip, SkipReason;
            """;
        await using (var summaryCommand = new SqlCommand(summarySql, connection))
        await using (var summaryReader = await summaryCommand.ExecuteReaderAsync(ct))
        {
            while (await summaryReader.ReadAsync(ct))
            {
                var skip = summaryReader.GetByte(0);
                var reason = summaryReader.IsDBNull(1) ? null : summaryReader.GetString(1);
                var count = summaryReader.GetInt64(2);
                candidateCount += count;
                if (skip == 0) fileCount = summaryReader.GetInt32(3);
                else if (skip == 1 && reason is not null) skipped[reason] = checked((int)count);
                else if (skip == 2) duplicateCount = count;
            }
        }
        if (candidateCount == 0)
            return Results.Problem(title: "Нет записей с кодом 207", detail: "В выбранном GF и МО не найдено записей с DN_LIST_RESULT_CODE=207.", statusCode: StatusCodes.Status422UnprocessableEntity);
        progressStore.SetTotal(progressId, fileCount, fileCount == 0 ? "Нет файлов для выгрузки" : "Чтение записей");

        const string readTempSql = """
            SELECT Id, MoCode, Enp, DnPatientId, SexCode, BirthDate, GroupRhCode,
                DiagnosisCode, GroupRhProfile, DoctorType,
                TriggerDate, TriggerInvoiceDate, TriggerDiagnosisCode, TriggerMoCode,
                TriggerHistoryNumber, TriggerCaseId
            FROM #d05
            WHERE Skip=0
            ORDER BY Skip, MoCode, Enp, GroupRhCode, Id;
            """;
        var generatedOn = DateTime.UtcNow.Date;
        var deadline = new DateTime(generatedOn.Year, generatedOn.Month, 16);
        var sourceName = Path.GetFileNameWithoutExtension(file.FileName);
        var yyMm = sourcePeriod.ToString("yyMM", CultureInfo.InvariantCulture);
        var baseName = $"D05_TEST_{sourceName}";
        var emittedCount = 0;
        string? currentMo = null;
        var packageTasks = new List<D05TaskData>();

        context.Response.ContentType = "application/zip";
        context.Response.Headers.ContentDisposition = $"attachment; filename=\"{baseName}.zip\"";
        context.Response.Headers["X-D05-Test-Mode"] = "synthetic-person-data";
        using var responseStream = new AsyncResponseStream(context.Response.Body);
        using (var archive = new System.IO.Compression.ZipArchive(responseStream, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true))
        {
            async Task WritePackageAsync()
            {
                if (currentMo is null || packageTasks.Count == 0) { packageTasks.Clear(); return; }
                var packNumber = "001";
                var name = $"D05M{currentMo}T34_{yyMm}{packNumber}";
                var header = new D05Header(currentMo, name, sourceName, sourcePeriod.Year, sourcePeriod.Month, generatedOn, deadline, packNumber, packageTasks.Count);
                var packageBytes = D05PackageExport.CreateZip(header, packageTasks);
                var packageEntry = archive.CreateEntry($"{name}.zip", System.IO.Compression.CompressionLevel.Fastest);
                await using var packageStream = packageEntry.Open();
                await packageStream.WriteAsync(packageBytes, ct);
                progressStore.Advance(progressId, 1, $"Сформирован файл МО {currentMo}");
                packageTasks.Clear();
            }

            await using (var command = new SqlCommand(readTempSql, connection) { CommandTimeout = 300 })
            {
                await using var reader = await command.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    var rowMo = reader.GetString(1).Trim();
                    if (!string.Equals(rowMo, currentMo, StringComparison.Ordinal))
                    {
                        await WritePackageAsync();
                        currentMo = rowMo;
                    }

                    var enp = reader.GetString(2).Trim();
                    var diagnosis = reader.GetString(7).Trim();

                    var sex = reader.GetInt32(4);
                    var groupCode = reader.GetInt32(6);
                    var (surname, name, patronymic) = D05TestNames.For(enp, sex);
                    var taskId = (emittedCount + 1).ToString(CultureInfo.InvariantCulture);
                    var profile = reader.IsDBNull(8) ? null : reader.GetString(8).Trim();
                    packageTasks.Add(new D05TaskData(
                        Zap: packageTasks.Count + 1,
                        TaskId: taskId,
                        Enp: enp,
                        DnPatientId: reader.IsDBNull(3) ? null : LimitD05Text(reader.GetString(3), 36),
                        Surname: surname,
                        Name: name,
                        Patronymic: patronymic,
                        Birthday: reader.GetDateTime(5),
                        Sex: sex,
                        GroupRhCode: groupCode,
                        GroupRhName: $"group_rh={groupCode}",
                        DiagnosisCode: diagnosis,
                        GroupRhProfile: string.IsNullOrWhiteSpace(profile) ? null : profile[..Math.Min(100, profile.Length)],
                        DoctorType: !reader.IsDBNull(9) && reader.GetInt32(9) is >= 0 and <= 9999 ? reader.GetInt32(9) : null,
                        TriggerDate: reader.IsDBNull(10) ? null : reader.GetDateTime(10),
                        TriggerInvoiceDate: reader.IsDBNull(11) ? null : reader.GetDateTime(11),
                        TriggerDiagnosisCode: reader.IsDBNull(12) ? null : reader.GetString(12),
                        TriggerMoCode: reader.IsDBNull(13) ? null : reader.GetString(13),
                        TriggerHistoryNumber: reader.IsDBNull(14) ? null : reader.GetString(14),
                        TriggerCaseId: reader.IsDBNull(15) ? null : reader.GetString(15)));
                    emittedCount++;
                }
            }
            await WritePackageAsync();

            var readme = archive.CreateEntry("README_TEST.txt", System.IO.Compression.CompressionLevel.Fastest);
            await using (var readmeStream = readme.Open())
            await using (var readmeWriter = new StreamWriter(readmeStream, new UTF8Encoding(false)))
            {
                await readmeWriter.WriteLineAsync("TEST D05 package set. Do not send these files to medical organizations.");
                await readmeWriter.WriteLineAsync("Names are synthetic; IDPAC=0; TASK_ID is sequential from 1 across this export; REPEAT_CNT=1; previous task is omitted.");
                await readmeWriter.WriteLineAsync("CODE_MO and CODEM are copied from ATTACH_MCODE. Dead/uninsured exclusions are not applied.");
                await readmeWriter.WriteLineAsync("GROUP_RH_NAME is generated as group_rh={GROUP_RH_CD}. TRIGGER is copied when available.");
                await readmeWriter.WriteLineAsync($"Source GF: {file.FileName}; candidate rows: {candidateCount}; duplicates: {duplicateCount}; D05 tasks: {emittedCount}; skipped: {skipped.Values.Sum()}.");
                foreach (var item in skipped.OrderBy(x => x.Key, StringComparer.Ordinal))
                    await readmeWriter.WriteLineAsync($"Skipped ({item.Value}): {item.Key}.");
            }
        }
        await context.Response.Body.FlushAsync(ct);
        return Results.Empty;
    }

    public async Task<ResultDictionaries> GetResultCodes(CancellationToken ct)
    {
        await using var connection = OpenConnection();
        var gst = await connection.QueryAsync<DictionaryDb>(new CommandDefinition("SELECT code, description, recommended_action AS recommendation FROM dbo.dict_dn_list_result_code ORDER BY TRY_CONVERT(int,code);", cancellationToken: ct));
        var gpt = await connection.QueryAsync<DictionaryDb>(new CommandDefinition("SELECT code, description, recommended_action AS recommendation FROM dbo.dict_dn_plan_result_code ORDER BY code;", cancellationToken: ct));
        return new ResultDictionaries(gst.Select(x => new ResultCodeDto(x.Code, x.Description, Category("GST", x.Code.ToString()), x.Recommendation)).ToList(), gpt.Select(x => new ResultCodeDto(x.Code, x.Description, Category("GPT", x.Code.ToString()), x.Recommendation)).ToList());
    }

    public async Task<IResult> GetAnalytics(string fileId, int repeatPeriods, int top, CancellationToken ct)
    {
        var file = await GetFile(fileId, ct);
        if (file is null) return Results.NotFound();
        if (file.Type != "GF") return Results.Conflict(new { error = new { code = "FILE_TYPE_NOT_SUPPORTED", message = "Сводка доступна только для файлов GF." } });
        var importId = ParseFileId(fileId, "gf-");
        const string sql = """
            SELECT 'GST' AS type, l.DN_LIST_RESULT_CODE AS code, l.DN_LIST_RESULT_DESCR AS description, COUNT(*) AS count
            FROM dbo.gf_person p JOIN dbo.gf_dn_list_result l ON l.person_id=p.id WHERE p.import_id=@ImportId AND l.DN_LIST_RESULT_CODE IS NOT NULL GROUP BY l.DN_LIST_RESULT_CODE,l.DN_LIST_RESULT_DESCR
            UNION ALL
            SELECT 'GPT', CONVERT(varchar(20),g.DN_PLAN_RESULT_CODE), g.DN_PLAN_RESULT_DESCR, COUNT(*)
            FROM dbo.gf_person p JOIN dbo.gf_dn_plan_result g ON g.person_id=p.id WHERE p.import_id=@ImportId AND g.DN_PLAN_RESULT_CODE IS NOT NULL GROUP BY g.DN_PLAN_RESULT_CODE,g.DN_PLAN_RESULT_DESCR;
            """;
        await using var connection = OpenConnection();
        var grouped = (await connection.QueryAsync<CodeCount>(new CommandDefinition(sql, new { ImportId = importId }, commandTimeout: 120, cancellationToken: ct))).ToList();
        var totalGst = grouped.Where(x => x.Type == "GST").Sum(x => (long)x.Count);
        var totalGpt = grouped.Where(x => x.Type == "GPT").Sum(x => (long)x.Count);
        var codes = grouped.Select(x => new { x.Type, x.Code, x.Description, category = Category(x.Type, x.Code), x.Count });
        var categories = codes.GroupBy(x => (x.Type, x.category)).Select(x => new { type = x.Key.Type, category = x.Key.category, count = x.Sum(r => r.Count), percent = Math.Round(100d * x.Sum(r => r.Count) / Math.Max(1, x.Key.Type == "GST" ? totalGst : totalGpt), 1) }).ToList();
        var frequentCodes = codes.Where(x => Category(x.Type, x.Code) is "fix_and_resend" or "verify_basis" or "missing_gst").OrderByDescending(x => x.Count).Take(top).ToList();
        var repeats = await GetRepeatedErrors(connection, importId, repeatPeriods, databaseOptions.RegionCode, ct);
        return Results.Ok(new { fileId = file.Id, fileName = file.FileName, recordCount = file.RecordCount ?? 0, checks = new { gst = totalGst, gpt = totalGpt }, categories, topResultCodes = frequentCodes, repeatedErrors = repeats, generatedAt = DateTime.UtcNow });
    }

    private static async Task<IReadOnlyList<object>> GetRepeatedErrors(SqlConnection connection, long currentImportId, int minimum, string regionCode, CancellationToken ct)
    {
        const string sql = """
            WITH current_period AS (
              SELECT TRY_CONVERT(int, LEFT(period,4))*12 + TRY_CONVERT(int,RIGHT(period,2)) AS month_no FROM dbo.file_import_log WHERE id=@CurrentImportId
            ), periods AS (
              SELECT i.id, TRY_CONVERT(int, LEFT(i.period,4))*12 + TRY_CONVERT(int,RIGHT(i.period,2)) AS month_no
              FROM dbo.file_import_log i CROSS JOIN current_period c
              WHERE i.region_cd=@RegionCode AND i.id<=@CurrentImportId
                AND TRY_CONVERT(int, i.period) IS NOT NULL
                AND TRY_CONVERT(int, LEFT(i.period,4))*12 + TRY_CONVERT(int,RIGHT(i.period,2)) BETWEEN c.month_no-23 AND c.month_no
            ), checks AS (
              SELECT p.DN_PATIENT_ID AS patientId, p.ATTACH_MCODE AS moCode, 'GST' AS type, l.DN_LIST_RESULT_CODE AS code, f.month_no
              FROM periods f JOIN dbo.gf_person p ON p.import_id=f.id JOIN dbo.gf_dn_list_result l ON l.person_id=p.id
              WHERE p.DN_PATIENT_ID IS NOT NULL AND l.DN_LIST_RESULT_CODE IS NOT NULL AND f.month_no IS NOT NULL AND l.DN_LIST_RESULT_CODE NOT IN ('201','202','203','208')
              UNION ALL
              SELECT p.DN_PATIENT_ID,p.ATTACH_MCODE,'GPT',CONVERT(varchar(20),g.DN_PLAN_RESULT_CODE),f.month_no
              FROM periods f JOIN dbo.gf_person p ON p.import_id=f.id JOIN dbo.gf_dn_plan_result g ON g.person_id=p.id
              WHERE p.DN_PATIENT_ID IS NOT NULL AND g.DN_PLAN_RESULT_CODE IS NOT NULL AND f.month_no IS NOT NULL AND g.DN_PLAN_RESULT_CODE NOT IN (301,302,303,306)
            ), distinct_checks AS (SELECT DISTINCT patientId,moCode,type,code,month_no FROM checks), ordered AS (
              SELECT *, month_no - ROW_NUMBER() OVER(PARTITION BY patientId,type,code ORDER BY month_no) AS run_id FROM distinct_checks
            ), runs AS (
              SELECT patientId,MAX(moCode) AS moCode,type,code,run_id,COUNT(*) AS periodCount,MIN(month_no) AS firstMonth,MAX(month_no) AS lastMonth
              FROM ordered GROUP BY patientId,type,code,run_id HAVING COUNT(*)>=@Minimum AND MAX(month_no)= (SELECT month_no FROM periods WHERE id=@CurrentImportId)
            )
            SELECT TOP(100) patientId AS DnPatientId,moCode,type,code,periodCount,firstMonth,lastMonth FROM runs ORDER BY periodCount DESC;
            """;
        var rows = await connection.QueryAsync<RepeatDb>(new CommandDefinition(sql, new { Minimum = minimum, CurrentImportId = currentImportId, RegionCode = regionCode }, commandTimeout: 120, cancellationToken: ct));
        return rows.Select(x => (object)new { dnPatientId = x.DnPatientId, moCode = x.MoCode, type = x.Type, code = x.Code, periodCount = x.PeriodCount, periods = MonthRange(x.FirstMonth, x.LastMonth), recommendation = (string?)null }).ToList();
    }

    private static IEnumerable<string> MonthRange(int from, int to)
    {
        for (var month = from; month <= to && month - from < 60; month++)
        {
            var year = (month - 1) / 12;
            var m = (month - 1) % 12 + 1;
            yield return $"{year:D4}-{m:D2}";
        }
    }

    private static RecordDto ToRecord(RecordDb row, object? gisEvidence = null) => new(
        row.Id.ToString(CultureInfo.InvariantCulture), row.Enp, row.DnPatientId, row.DiagnosisCode, row.GroupRhCode, row.GroupRhProfile, row.GroupRhName, row.DnRuleInName,
        new PatientDto(row.SexCode, Date(row.BirthDate), row.SmoCode, row.AttachMoCode, Date(row.AttachDate), row.SmoRegionCode),
        row.ListResultCode is null && row.CodeL is null && row.ListFileName is null ? null : new ResultBranchDto(Period(row.ListPeriod), row.ListFileName, row.CodeL, row.ListResultCode, Date(row.ListResultDate), row.ListDescription),
        row.PlanResultCode is null && row.CodeP is null && row.PlanFileName is null ? null : new ResultBranchDto(Period(row.PlanPeriod), row.PlanFileName, row.CodeP, row.PlanResultCode, Date(row.PlanResultDate), row.PlanDescription),
        row.InsertedAt, row.UpdatedAt, row.MoCode, gisEvidence);

    private static string Category(string type, string code)
    {
        if (type == "GST") return code switch { "201" => "accepted", "202" => "accepted_with_warning", "203" or "208" => "closed_exclude", "205" or "207" or "209" => "verify_basis", _ => "fix_and_resend" };
        return code switch { "301" => "accepted", "302" or "303" or "306" => "closed_exclude", "304" => "verify_basis", "307" or "311" => "missing_gst", _ => "fix_and_resend" };
    }

    private static string? Date(DateTime? value) => value?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    private static string? Period(int? value) => value is null ? null : $"{value / 100:D4}-{value % 100:D2}";
    private static string? Period(DateTime? value) => value is null ? null : value.Value.ToString("yyyy-MM", CultureInfo.InvariantCulture);

    private static long ParseFileId(string value, string prefix) => value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && long.TryParse(value[prefix.Length..], out var id) ? id : throw new ArgumentException("Invalid file id");
    private (string Where, DynamicParameters Parameters) FileFilters(FileQuery query, bool includeQuery = true, bool includeDirection = true)
    {
        var clauses = new List<string>(); var p = new DynamicParameters();
        p.Add("RegionCode", databaseOptions.RegionCode);
        if (includeQuery && !string.IsNullOrWhiteSpace(query.Q)) { clauses.Add("fileName LIKE @Q"); p.Add("Q", $"%{EscapeLike(query.Q)}%"); }
        if (!string.IsNullOrWhiteSpace(query.Type)) { clauses.Add("type=@Type"); p.Add("Type", query.Type.ToUpperInvariant()); }
        if (!string.IsNullOrWhiteSpace(query.PeriodFrom)) { clauses.Add("period>=@PeriodFrom"); p.Add("PeriodFrom", query.PeriodFrom); }
        if (!string.IsNullOrWhiteSpace(query.PeriodTo)) { clauses.Add("period<=@PeriodTo"); p.Add("PeriodTo", query.PeriodTo); }
        if (!string.IsNullOrWhiteSpace(query.Status)) { clauses.Add("status=@Status"); p.Add("Status", query.Status.ToLowerInvariant()); }
        if (includeDirection && !string.IsNullOrWhiteSpace(query.Direction)) { clauses.Add("direction=@Direction"); p.Add("Direction", query.Direction.ToLowerInvariant()); }
        return (clauses.Count == 0 ? "" : "WHERE " + string.Join(" AND ", clauses), p);
    }

    private static (string Where, DynamicParameters Parameters) RecordFilters(RecordQuery query)
    {
        var clauses = new List<string>(); var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var search = query.Q.Trim();
            if (search.Length == 16 && search.All(char.IsAsciiDigit))
            {
                clauses.Add("p.ENP=@Q");
                p.Add("Q", search, DbType.AnsiString, size: 16);
            }
            else
            {
                clauses.Add("(p.ENP LIKE @Q OR p.DN_PATIENT_ID LIKE @Q OR l.CODE_L LIKE @Q OR g.CODE_P LIKE @Q)");
                p.Add("Q", $"%{EscapeLike(search)}%");
            }
        }
        if (query.ResultCode is not null) { clauses.Add("(l.DN_LIST_RESULT_CODE=@ResultCodeText OR g.DN_PLAN_RESULT_CODE=@ResultCode)"); p.Add("ResultCodeText", query.ResultCode.Value.ToString(CultureInfo.InvariantCulture)); p.Add("ResultCode", query.ResultCode); }
        if (!string.IsNullOrWhiteSpace(query.MoCode)) { clauses.Add("p.ATTACH_MCODE=@MoCode"); p.Add("MoCode", query.MoCode); }
        if (!string.IsNullOrWhiteSpace(query.Category)) { clauses.Add("(CASE WHEN l.DN_LIST_RESULT_CODE IS NOT NULL THEN " + CategorySql("GST", "l.DN_LIST_RESULT_CODE") + " END=@Category OR CASE WHEN g.DN_PLAN_RESULT_CODE IS NOT NULL THEN " + CategorySql("GPT", "CONVERT(varchar(20),g.DN_PLAN_RESULT_CODE)") + " END=@Category)"); p.Add("Category", query.Category); }
        return (clauses.Count == 0 ? "" : "AND " + string.Join(" AND ", clauses), p);
    }

    private static string CategorySql(string type, string code) => type == "GST"
        ? $"CASE {code} WHEN '201' THEN 'accepted' WHEN '202' THEN 'accepted_with_warning' WHEN '203' THEN 'closed_exclude' WHEN '208' THEN 'closed_exclude' WHEN '205' THEN 'verify_basis' WHEN '207' THEN 'verify_basis' WHEN '209' THEN 'verify_basis' ELSE 'fix_and_resend' END"
        : $"CASE {code} WHEN '301' THEN 'accepted' WHEN '302' THEN 'closed_exclude' WHEN '303' THEN 'closed_exclude' WHEN '306' THEN 'closed_exclude' WHEN '304' THEN 'verify_basis' WHEN '307' THEN 'missing_gst' WHEN '311' THEN 'missing_gst' ELSE 'fix_and_resend' END";

    private static void ValidateFileFilters(FileQuery query)
    {
        if (query.Type is not null && query.Type.ToUpperInvariant() is not ("GST" or "GPT" or "GF")) throw new BadHttpRequestException("type должен быть GST, GPT или GF.");
        if (query.Direction is not null && query.Direction.ToLowerInvariant() is not ("inbound" or "outbound")) throw new BadHttpRequestException("direction должен быть inbound или outbound.");
        if (query.Status is not null && query.Status.ToLowerInvariant() is not ("queued" or "processing" or "processed" or "sent" or "failed")) throw new BadHttpRequestException("Неизвестный статус файла.");
        if (!ValidPeriod(query.PeriodFrom) || !ValidPeriod(query.PeriodTo)) throw new BadHttpRequestException("Период должен иметь формат YYYY-MM.");
    }

    private static bool ValidPeriod(string? period) => period is null || (period.Length == 7 && period[4] == '-' && int.TryParse(period.AsSpan(0, 4), out _) && int.TryParse(period.AsSpan(5, 2), out var month) && month is >= 1 and <= 12);

    private static string EscapeLike(string value) => value.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]");
    private static string Csv(string value) => value.Contains(';') || value.Contains('"') || value.Contains('\r') || value.Contains('\n') ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    private static string? LimitD05Text(string value, int length) { var trimmed = value.Trim(); return trimmed.Length is > 0 && trimmed.Length <= length ? trimmed : null; }

    private sealed class AsyncResponseStream(Stream inner) : Stream
    {
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override Task FlushAsync(CancellationToken cancellationToken) => inner.FlushAsync(cancellationToken);
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => inner.WriteAsync(buffer.AsMemory(offset, count)).GetAwaiter().GetResult();
        public override void Write(ReadOnlySpan<byte> buffer) => inner.WriteAsync(buffer.ToArray()).GetAwaiter().GetResult();
        public override void WriteByte(byte value) => Write(new[] { value }, 0, 1);
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) => inner.WriteAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default) => inner.WriteAsync(buffer, cancellationToken);
        protected override void Dispose(bool disposing) { }
    }

    private static void AddParameters(SqlCommand command, DynamicParameters parameters)
    {
        foreach (var name in parameters.ParameterNames) command.Parameters.AddWithValue("@" + name, parameters.Get<object>(name) ?? DBNull.Value);
    }

    private sealed class SummaryDb { public int TotalFiles { get; set; } public int OutboundGstGpt { get; set; } public int InboundGf { get; set; } public int FailedFiles { get; set; } public DateTime? AsOf { get; set; } }
    private sealed class DictionaryDb { public object Code { get; set; } = ""; public string Description { get; set; } = ""; public string? Recommendation { get; set; } }
    private sealed class CodeCount { public string Type { get; set; } = ""; public string Code { get; set; } = ""; public string Description { get; set; } = ""; public int Count { get; set; } }
    private sealed class RepeatDb { public string DnPatientId { get; set; } = ""; public string? MoCode { get; set; } public string Type { get; set; } = ""; public string Code { get; set; } = ""; public int PeriodCount { get; set; } public int FirstMonth { get; set; } public int LastMonth { get; set; } }
    private sealed class RecordDb
    {
        public long Id { get; set; } public string? Enp { get; set; } public string? DnPatientId { get; set; } public string? DiagnosisCode { get; set; } public int? GroupRhCode { get; set; } public string? GroupRhProfile { get; set; } public string? GroupRhName { get; set; } public string? DnRuleInName { get; set; }
        public int? SexCode { get; set; } public DateTime? BirthDate { get; set; } public string? SmoCode { get; set; } public string? AttachMoCode { get; set; } public DateTime? AttachDate { get; set; } public string? SmoRegionCode { get; set; }
        public int? ListPeriod { get; set; } public string? ListFileName { get; set; } public string? CodeL { get; set; } public string? ListResultCode { get; set; } public DateTime? ListResultDate { get; set; } public string? ListDescription { get; set; }
        public DateTime? PlanPeriod { get; set; } public string? PlanFileName { get; set; } public string? CodeP { get; set; } public int? PlanResultCode { get; set; } public DateTime? PlanResultDate { get; set; } public string? PlanDescription { get; set; }
        public DateTime? InsertedAt { get; set; } public DateTime? UpdatedAt { get; set; } public string? MoCode { get; set; }
        public string? TriggerFileName { get; set; } public string? TriggerCode { get; set; } public string? TriggerInvoiceNumber { get; set; } public DateTime? TriggerInvoiceDate { get; set; } public string? TriggerCaseId { get; set; } public string? TriggerServiceId { get; set; } public string? TriggerHistoryNumber { get; set; } public string? TriggerDiagnosisCode { get; set; } public string? TriggerMoCode { get; set; } public DateTime? TriggerDate { get; set; }
    }
}
