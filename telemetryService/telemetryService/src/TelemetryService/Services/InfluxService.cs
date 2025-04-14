using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;

namespace TelemetryService.Services
{
    public class InfluxService
    {
        public async Task WriteTick()
        {
            string? url = Environment.GetEnvironmentVariable("INFLUX_URL");
            string? token = Environment.GetEnvironmentVariable("INFLUX_TOKEN");
            using var client = new InfluxDBClient(url, token);

            using (var writeApi = client.GetWriteApi())
            {
                writeApi.EventHandler += handleEvents;
                
                var pointData = PointData
                    .Measurement("hello")
                    .Tag("plane", "test-plane")
                    .Field("value", 55D)
                    .Timestamp(DateTime.UtcNow.AddSeconds(-10), WritePrecision.Ns);
                
                writeApi.WritePoint(pointData, "temp", "myorg"); 
                Console.WriteLine("Data sent");
            }
        }

        private void handleEvents(object? sender, EventArgs eventArgs)
        {
            switch (eventArgs)
            {
                case WriteSuccessEvent successEvent:
                    Console.WriteLine("WriteSuccessEvent: point was successfully written to InfluxDB");
                    break;
                case WriteErrorEvent errorEvent:
                    Console.WriteLine($"WriteErrorEvent: {errorEvent.Exception.Message}");
                    Console.WriteLine($"  - {errorEvent.LineProtocol}");
                    break;
                case WriteRetriableErrorEvent error:
                    Console.WriteLine($"WriteRetriableErrorEvent: {error.Exception.Message}");
                    Console.WriteLine($"  - {error.LineProtocol}");
                    break;
                case WriteRuntimeExceptionEvent error:
                    Console.WriteLine($"WriteRuntimeExceptionEvent: {error.Exception.Message}");
                    break;
                default:
                    Console.WriteLine(eventArgs);
                    break;
            }
        }
    }
}