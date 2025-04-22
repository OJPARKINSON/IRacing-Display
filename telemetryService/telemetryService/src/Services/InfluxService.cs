using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;
using TelemetryService.Models;

namespace TelemetryService.Services
{
    public class InfluxService
    {
        private readonly Dictionary<string, bool> _createdBuckets = new Dictionary<string, bool>();

        public async Task WriteTicks(List<TelemetryData> telData)
        {
            if (telData == null || telData.Count == 0)
            {
                Console.WriteLine("No telemetry data to write");
                return;
            }

            string? url = Environment.GetEnvironmentVariable("INFLUX_URL");
            string? token = Environment.GetEnvironmentVariable("INFLUX_TOKEN");
            using var client = new InfluxDBClient(url, token);

            string bucketName = $"telemetry_{telData[0].Session_id}";
            
            if (!_createdBuckets.ContainsKey(bucketName))
            {
                try
                {
                    var bucketsApi = client.GetBucketsApi();
                    var buckets = await bucketsApi.FindBucketsAsync();
                    bool bucketExists = buckets.Any(b => b.Name == bucketName);

                    if (!bucketExists)
                    {
                        Console.WriteLine($"Creating new bucket: {bucketName}");
                        var retentionRules = new BucketRetentionRules(BucketRetentionRules.TypeEnum.Expire, 0);
                        await bucketsApi.CreateBucketAsync(bucketName, retentionRules, "myorg");
                    }
                    else
                    {
                        Console.WriteLine($"Bucket {bucketName} already exists");
                    }

                    _createdBuckets[bucketName] = true;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error checking/creating bucket: {ex.Message}");
                }
            }
            
            using (var writeApi = client.GetWriteApi())
            {
                writeApi.EventHandler += handleEvents;
                
                List<PointData> pointData = [];

                foreach (var tel in telData)
                {
                    pointData.Add(
                        PointData
                            .Measurement("tel")
                            .Tag("lap_id", tel.Lap_id)
                            .Tag("session_id", tel.Session_id)
                            .Tag("session_num", tel.Session_num)
                            .Field("speed", tel.Speed)
                            .Field("lap_dist_pct", tel.Lap_dist_pct)
                            .Field("session_time", tel.Session_time)
                            .Field("lap_current_lap_time", tel.Lap_current_lap_time)
                            .Field("car_id", tel.Car_id)
                            .Field("brake", tel.Brake)
                            .Field("throttle", tel.Throttle)
                            .Field("gear", tel.Gear)
                            .Field("rpm", tel.Rpm)
                            .Field("steering_wheel_angle", tel.Steering_wheel_angle)
                            .Field("velocity_x", tel.Velocity_x)
                            .Field("velocity_y", tel.Velocity_y)
                            .Field("lat", tel.Lat)
                            .Field("lon", tel.Lon)
                            .Field("player_car_position", tel.Player_car_position)
                            .Field("fuel_level", tel.Fuel_level)
                            .Timestamp(DateTime.UtcNow.AddSeconds(-10), WritePrecision.Ns)
                    );
                }
                
                writeApi.WritePoints(pointData, bucketName, "myorg"); 
                
                writeApi.Flush();
                
                Console.WriteLine($"Data sent: {pointData.Count} points to bucket {bucketName}");
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
            }
        }
    }
}