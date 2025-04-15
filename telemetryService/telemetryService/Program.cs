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
            var root = Directory.GetCurrentDirectory();
            var dotenv = Path.Combine(root, ".env.influxdb-admin-token");
            DotEnv.Load(dotenv);

            using IHost host = CreateHostBuilder(args).Build();

            var subscriber = host.Services.GetRequiredService<Subscriber>();
            
            Console.WriteLine("Starting telemetry service...");
            await subscriber.SubscribeAsync();

            await host.RunAsync();
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

