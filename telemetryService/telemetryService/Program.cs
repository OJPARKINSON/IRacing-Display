using InfluxDB.Client;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TelemetryService.Config;
using TelemetryService.Services;
using TelemetryService.Services.Subscriber;

namespace TelemetryService
{
    class Program
    {
        private static async Task Main(string[] args)
        {
            try
            {
                LoadEnvironmentVariables();
                
                using IHost host = CreateHostBuilder(args).Build();
                
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
                Path.Combine(root, ".env.influxdb-admin-token"),
                Path.Combine(root, ".env.influx-token")
            };
            
            bool anyFileLoaded = false;
            
            foreach (var file in possibleFiles)
            {
                if (File.Exists(file))
                {
                    Console.WriteLine($"Loading environment from {file}");
                    DotEnv.Load(file);
                    anyFileLoaded = true;
                }
            }
            
            if (!anyFileLoaded)
            {
                Console.WriteLine("No environment files found. Using container environment variables.");
            }
        }

        private static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureServices((_, services) =>
                {
                    services.AddSingleton<Telemetry>();
                    services.AddSingleton<InfluxService>();
                    services.AddSingleton<Subscriber>();
                });
    }
}