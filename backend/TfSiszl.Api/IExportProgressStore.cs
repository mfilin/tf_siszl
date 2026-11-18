internal sealed record ExportProgress(
    Guid Id,
    int CompletedFiles,
    int TotalFiles,
    string Status,
    bool IsCompleted,
    string? Error);

internal interface IExportProgressStore
{
    ExportProgress? Get(Guid operationId);
    void Start(Guid operationId, string status);
    void SetTotal(Guid operationId, int totalFiles, string status);
    void Advance(Guid operationId, int files, string status);
    void Complete(Guid operationId, string status);
    void Fail(Guid operationId, string status, string? error = null);
}
