using TelemetryService.Application.Services;
using TelemetryService.Configuration.Config;
using TelemetryService.Persistence.Services;

var builder = WebApplication.CreateBuilder(args);

// Load environment variables
LoadEnvironmentVariables();

// Add services to the container
builder.Services.AddControllers();

// Add API documentation (Swagger)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Telemetry Service API", Version = "v1" });
});

// Add CORS for development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Register your application services
builder.Services.AddSingleton<Telemetry>();
builder.Services.AddSingleton<InfluxService>();

// Add logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var app = builder.Build();

// Debug: Log all registered routes
var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("=== Registered Routes ===");

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Telemetry Service API v1");
        c.RoutePrefix = string.Empty; // Swagger UI at root
    });
}

app.UseCors();
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

Console.WriteLine("🚀 Telemetry Service API is starting...");
Console.WriteLine($"Environment: {app.Environment.EnvironmentName}");
Console.WriteLine("Swagger UI available at: http://localhost:5000 (in development)");

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