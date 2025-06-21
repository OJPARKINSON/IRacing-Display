using TelemetryService.Application.Services;
using TelemetryService.Infrastructure.Configuration;
using TelemetryService.Infrastructure.Persistence;
using TelemetryService.Infrastructure.Messaging;

var builder = WebApplication.CreateBuilder(args);

LoadEnvironmentVariables();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Telemetry Service API", Version = "v1" });
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddSingleton<Telemetry>();
builder.Services.AddSingleton<InfluxService>();
builder.Services.AddSingleton<Subscriber>();

builder.Services.AddHostedService<TelemetryBackgroundService>();

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Telemetry Service API v1");
        c.RoutePrefix = string.Empty;
    });
}

app.UseCors();
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

Console.WriteLine("🚀 Telemetry Service starting...");
Console.WriteLine("✅ HTTP API endpoints enabled");
Console.WriteLine("✅ Background RabbitMQ processing enabled");
Console.WriteLine($"Environment: {app.Environment.EnvironmentName}");

app.Run();

static void LoadEnvironmentVariables()
{
    var root = Directory.GetCurrentDirectory();
    var envFile = Path.Combine(root, ".env");

    if (File.Exists(envFile))
    {
        Console.WriteLine($"Loading environment from {envFile}");
        DotEnv.Load(envFile);
    }
    else
    {
        Console.WriteLine("No .env file found. Using system environment variables.");
    }
}

public class TelemetryBackgroundService : BackgroundService
{
    private readonly Subscriber _subscriber;
    private readonly ILogger<TelemetryBackgroundService> _logger;

    public TelemetryBackgroundService(Subscriber subscriber, ILogger<TelemetryBackgroundService> logger)
    {
        _subscriber = subscriber;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation("🔄 Starting RabbitMQ subscriber...");
            await _subscriber.SubscribeAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error in RabbitMQ subscriber");
            throw;
        }
    }
}