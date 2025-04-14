using TelemetryService.Config;
using TelemetryService.Services;

namespace TelemetryService
{
    class Program
    {
        private static async Task Main()
        {
            var root = Directory.GetCurrentDirectory();
            var dotenv =  Path.Combine(root, ".env.influxdb-admin-token");
            DotEnv.Load(dotenv);

            var influxService = new InfluxService();
            await influxService.WriteTick();
        }
    }
}

