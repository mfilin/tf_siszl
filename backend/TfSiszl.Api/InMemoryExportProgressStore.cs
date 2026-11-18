using System.Collections.Concurrent;

internal sealed class InMemoryExportProgressStore : IExportProgressStore
{
    private static readonly TimeSpan RetentionPeriod = TimeSpan.FromMinutes(30);
    private readonly ConcurrentDictionary<Guid, (ExportProgress Progress, DateTime CreatedAt)> _items = new();

    public void Start(Guid operationId, string status)
    {
        RemoveExpired();
        _items[operationId] = (new ExportProgress(operationId, 0, 0, status, false, null), DateTime.UtcNow);
    }

    public ExportProgress? Get(Guid operationId) =>
        _items.TryGetValue(operationId, out var item) ? item.Progress : null;

    public void SetTotal(Guid operationId, int totalFiles, string status) => Update(operationId, progress => progress with
    {
        TotalFiles = Math.Max(0, totalFiles),
        Status = status
    });

    public void Advance(Guid operationId, int files, string status) => Update(operationId, progress => progress with
    {
        CompletedFiles = Math.Min(progress.TotalFiles, progress.CompletedFiles + Math.Max(0, files)),
        Status = status
    });

    public void Complete(Guid operationId, string status) => Update(operationId, progress => progress with
    {
        CompletedFiles = progress.TotalFiles,
        Status = status,
        IsCompleted = true
    });

    public void Fail(Guid operationId, string status, string? error = null) => Update(operationId, progress => progress with
    {
        Status = status,
        IsCompleted = true,
        Error = error
    });

    private void RemoveExpired()
    {
        var cutoff = DateTime.UtcNow - RetentionPeriod;
        foreach (var id in _items.Where(item => item.Value.CreatedAt < cutoff).Select(item => item.Key))
            _items.TryRemove(id, out _);
    }

    private void Update(Guid operationId, Func<ExportProgress, ExportProgress> update)
    {
        while (_items.TryGetValue(operationId, out var current))
        {
            var next = (update(current.Progress), current.CreatedAt);
            if (_items.TryUpdate(operationId, next, current)) return;
        }
    }
}
