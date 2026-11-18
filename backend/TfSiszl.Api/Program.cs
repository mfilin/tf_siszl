using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "TF_SISZL API",
        Version = "v1",
        Description = "API для просмотра файлов обмена, записей GF, аналитики и экспорта по медицинским организациям."
    });
});

var databaseOptions = DatabaseOptions.FromConfiguration(builder.Configuration);
builder.Services.AddSingleton(databaseOptions);
builder.Services.AddSingleton<SqlConnectionFactory>();
builder.Services.AddSingleton<D05ExportProgressStore>();
builder.Services.AddScoped<SiszlApi>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? ["http://localhost:5173"];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.Logger.LogInformation("""
    TF_SISZL — BACKEND API
    Реализовано: журнал GST/GPT/GF, карточки файлов и записей GF, фильтры и постраничная выборка.
    Экспорт: CSV, группировка по МО и тестовые ZIP-пакеты D05.
    Дополнительно: аналитика результатов, справочники, health/readiness, Swagger.
    Swagger: /swagger | API: /api/v1/dn
    """);

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "TF_SISZL API v1");
    options.RoutePrefix = "swagger";
});

app.UseCors();

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "tf-siszl-api",
    timestamp = DateTimeOffset.UtcNow
})).WithName("GetLiveness")
    .WithTags("Состояние сервиса")
    .WithSummary("Проверка API")
    .WithDescription("Показывает, что API запущен.");

app.MapGet("/health/ready", async (SqlConnectionFactory connectionFactory, CancellationToken cancellationToken) =>
{
    try
    {
        await using var connection = connectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT 1", connection);
        await command.ExecuteScalarAsync(cancellationToken);

        return Results.Ok(new
        {
            status = "ready",
            database = "connected",
            timestamp = DateTimeOffset.UtcNow
        });
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
        throw;
    }
    catch (Exception)
    {
        // Avoid returning connection details, host names, or credentials in health responses.
        return Results.Problem(
            title: "Database is unavailable",
            detail: "The API could not connect to the configured SQL Server database.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).WithName("GetReadiness")
    .WithTags("Состояние сервиса")
    .WithSummary("Проверка базы данных")
    .WithDescription("Проверяет подключение API к SQL Server.");

app.MapGet("/api/v1", () => Results.Ok(new
{
    name = "TF_SISZL API",
    version = "v1",
    health = "/health",
    readiness = "/health/ready"
})).WithTags("Состояние сервиса")
    .WithSummary("Информация об API")
    .WithDescription("Возвращает версию API и адреса проверок состояния.");

app.MapSiszlEndpoints();

app.Run();

internal sealed record DatabaseOptions(string Server, string Database, string User, string Password, string RegionCode)
{
    public static DatabaseOptions FromConfiguration(IConfiguration configuration) => new(
        configuration["Database:Server"] ?? "localhost",
        configuration["Database:Name"] ?? "TF_SISZL",
        configuration["Database:User"] ?? "sa",
        configuration["Database:Password"] ?? string.Empty,
        configuration["Database:RegionCode"] ?? "34");
}

internal sealed class SqlConnectionFactory(DatabaseOptions options)
{
    public SqlConnection CreateConnection()
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = options.Server,
            InitialCatalog = options.Database,
            UserID = options.User,
            Password = options.Password,
            Encrypt = true,
            TrustServerCertificate = true,
            ConnectTimeout = 5,
            ApplicationName = "TF-SISZL API"
        };

        return new SqlConnection(builder.ConnectionString);
    }
}
