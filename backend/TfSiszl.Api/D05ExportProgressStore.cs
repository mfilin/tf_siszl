using System.Collections.Concurrent;

internal sealed record D05ExportProgress(Guid Id, int CompletedFiles, int TotalFiles, string Status, bool IsCompleted, string? Error);

internal sealed class D05ExportProgressStore
{
    private readonly ConcurrentDictionary<Guid, (D05ExportProgress Progress, DateTime CreatedAt)> _items = new();

    public void Begin(Guid id)
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-30);
        foreach (var item in _items.Where(item => item.Value.CreatedAt < cutoff).Select(item => item.Key))
            _items.TryRemove(item, out _);

        _items[id] = (new D05ExportProgress(id, 0, 0, "Подготовка выборки", false, null), DateTime.UtcNow);
    }

    public D05ExportProgress? Get(Guid id) => _items.TryGetValue(id, out var item) ? item.Progress : null;

    public void SetTotal(Guid id, int totalFiles) => Update(id, progress => progress with
    {
        TotalFiles = totalFiles,
        Status = totalFiles == 0 ? "Нет файлов для выгрузки" : "Чтение записей"
    });

    public void FileCompleted(Guid id, string moCode) => Update(id, progress => progress with
    {
        CompletedFiles = Math.Min(progress.TotalFiles, progress.CompletedFiles + 1),
        Status = $"Сформирован файл МО {moCode}"
    });

    public void Complete(Guid id) => Update(id, progress => progress with
    {
        CompletedFiles = progress.TotalFiles,
        Status = "Выгрузка завершена",
        IsCompleted = true
    });

    public void Fail(Guid id, string error) => Update(id, progress => progress with
    {
        Status = "Ошибка выгрузки",
        IsCompleted = true,
        Error = error
    });

    private void Update(Guid id, Func<D05ExportProgress, D05ExportProgress> update)
    {
        while (_items.TryGetValue(id, out var current))
        {
            var next = (update(current.Progress), current.CreatedAt);
            if (_items.TryUpdate(id, next, current)) return;
        }
    }
}
