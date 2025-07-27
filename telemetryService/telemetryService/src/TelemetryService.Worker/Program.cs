using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TelemetryService.Application.Services;
using TelemetryService.Configuration.Config;
using TelemetryService.Persistence.Services;
using TelemetryService.Messaging.Services;

namespace TelemetryService;

internal class Program
{
    private static async Task Main(string[] args)
    {
        try
        {
            LoadEnvironmentVariables();

            using var host = CreateHostBuilder(args).Build();

            var subscriber = host.Services.GetRequiredService<Subscriber>();

            Console.WriteLine("Starting telemetry service...");
            await subscriber.SubscribeAsync();

            await host.RunAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Fatal error in telemetry service: {ex}");
            Environment.Exit(1);
        }
    }

    private static void LoadEnvironmentVariables()
    {
        var root = Directory.GetCurrentDirectory();
        var possibleFiles = new[]
        {
            Path.Combine(root, ".env")
        };

        var anyFileLoaded = false;

        foreach (var file in possibleFiles)
            if (File.Exists(file))
            {
                Console.WriteLine($"Loading environment from {file}");
                DotEnv.Load(file);
                anyFileLoaded = true;
            }

        if (!anyFileLoaded) Console.WriteLine("No environment files found. Using container environment variables.");
    }

    private static IHostBuilder CreateHostBuilder(string[] args)
    {
        return Host.CreateDefaultBuilder(args)
            .ConfigureServices((_, services) =>
            {
                services.AddSingleton<Telemetry>();
                services.AddSingleton<Subscriber>();
            });
    }
}