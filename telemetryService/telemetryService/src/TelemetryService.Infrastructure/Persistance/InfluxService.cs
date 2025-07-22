using CsvHelper;
using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;
using TelemetryService.Domain.Models;

namespace TelemetryService.Infrastructure.Persistence;

public class InfluxService : IDisposable
{
    private readonly InfluxDBClient? _client;
    private readonly Dictionary<string, bool> _createdBuckets = new Dictionary<string, bool>();

    public InfluxService()
    {
        string? url = Environment.GetEnvironmentVariable("INFLUXDB_URL");
        string? token = Environment.GetEnvironmentVariable("INFLUXDB_TOKEN");

        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(token))
        {
            Console.WriteLine($"ERROR: InfluxDB configuration is incomplete. URL: {(string.IsNullOrEmpty(url) ? "MISSING" : "OK")}, Token: {(string.IsNullOrEmpty(token) ? "MISSING" : "OK")}");
            return;
        }

        _client = new InfluxDBClient(url, token);
        Console.WriteLine("InfluxDB client initialized successfully");
    }

    public void Dispose()
    {
        _client?.Dispose();
    }

    public async Task WriteTicks(List<TelemetryData>? telData)
    {
        if (telData == null || telData.Count == 0)
        {
            Console.WriteLine("No telemetry data to write");
            return;
        }

        if (_client == null)
        {
            Console.WriteLine("ERROR: InfluxDB client is not initialized. Check environment variables.");
            return;
        }

        string bucketName = $"telemetry_{telData[0].Track_name}";

        if (!_createdBuckets.ContainsKey(bucketName))
        {
            try
            {
                var bucketsApi = _client.GetBucketsApi();
                var buckets = await bucketsApi.FindBucketsAsync();
                bool bucketExists = buckets.Any(b => b.Name == bucketName);

                if (!bucketExists)
                {
                    Console.WriteLine($"Creating new bucket: {bucketName}");

                    var orgsApi = _client.GetOrganizationsApi();
                    var orgs = await orgsApi.FindOrganizationsAsync();

                    if (orgs == null || !orgs.Any())
                    {
                        Console.WriteLine("ERROR: No organizations found in InfluxDB!");
                        return;
                    }

                    string orgId = orgs.First().Id;
                    Console.WriteLine($"Using organization ID: {orgId}");

                    var bucket = await bucketsApi.CreateBucketAsync(bucketName, orgId);
                    Console.WriteLine($"Successfully created bucket: {bucket.Name} with ID: {bucket.Id}");
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
                return;
            }
        }

        try
        {
            using (var writeApi = _client.GetWriteApi())
            {
                writeApi.EventHandler += HandleEvents;

                List<PointData> pointData = [];


                foreach (var tel in telData)
                {
                    Console.WriteLine($"DEBUG: Writing lap_id: '{tel.Lap_id}' for session: '{tel.Session_id}'");

                    pointData.Add(
                        PointData
                            .Measurement("telemetry_ticks")
                            .Tag("lap_id", tel.Lap_id ?? "unknown")
                            .Tag("session_id", tel.Session_id)
                            .Tag("session_num", tel.Session_num)
                            .Tag("car_id", tel.Car_id)
                            .Tag("track_name", tel.Track_name)
                            .Tag("track_id", tel.Track_id)
                            .Field("speed", tel.Speed)
                            .Field("lap_dist_pct", tel.Lap_dist_pct)
                            .Field("session_time", tel.Session_time)
                            .Field("lap_current_lap_time", tel.Lap_current_lap_time)
                            .Field("brake", tel.Brake)
                            .Field("throttle", tel.Throttle)
                            .Field("gear", tel.Gear)
                            .Field("rpm", tel.Rpm)
                            .Field("steering_wheel_angle", tel.Steering_wheel_angle)
                            .Field("velocity_x", tel.Velocity_x)
                            .Field("velocity_y", tel.Velocity_y)
                            .Field("velocity_z", tel.Velocity_Z)
                            .Field("lat", tel.Lat)
                            .Field("lon", tel.Lon)
                            .Field("player_car_position", tel.Player_car_position)
                            .Field("fuel_level", tel.Fuel_level)
                            .Field("tick_time", tel.Tick_time)
                            .Field("alt", tel.Alt)
                            .Field("lat_accel", tel.Lat_accel)
                            .Field("long_accel", tel.Long_accel)
                            .Field("vert_accel", tel.Vert_accel)
                            .Field("pitch", tel.Pitch)
                            .Field("roll", tel.Roll)
                            .Field("yaw", tel.Yaw)
                            .Field("yaw_north", tel.Yaw_north)
                            .Field("voltage", tel.Voltage)
                            .Field("lapLastLapTime", tel.LapLastLapTime)
                            .Field("waterTemp", tel.WaterTemp)
                            .Field("lapDeltaToBestLap", tel.LapDeltaToBestLap)
                            .Field("lapCurrentLapTime", tel.Lap_current_lap_time)
                            .Field("lFpressure", tel.LFpressure)
                            .Field("rFpressure", tel.RFpressure)
                            .Field("lRpressure", tel.LRpressure)
                            .Field("rRpressure", tel.RRpressure)
                            .Field("lFtempM", tel.LFtempM)
                            .Field("rFtempM", tel.RFtempM)
                            .Field("lRtempM", tel.LRtempM)
                            .Field("rRtempM", tel.RRtempM)
                            .Timestamp(DateTime.Parse(tel.Tick_time), WritePrecision.Ns)
                    );
                }


                writeApi.WritePoints(pointData, bucketName, "myorg");
                writeApi.Flush();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR writing to InfluxDB: {ex.Message}");
            Console.WriteLine($"Exception type: {ex.GetType().Name}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");

            if (ex.InnerException != null)
            {
                Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
                Console.WriteLine($"Inner exception type: {ex.InnerException.GetType().Name}");
            }
        }
    }

    private void HandleEvents(object? sender, EventArgs eventArgs)
    {
        switch (eventArgs)
        {
            case WriteSuccessEvent successEvent:
                Console.WriteLine("WriteSuccessEvent: point was successfully written to InfluxDB");
                break;
            case WriteErrorEvent errorEvent:
                Console.WriteLine($"Write error: {errorEvent.Exception.Message}");
                Console.WriteLine($"  - Protocol: {errorEvent.LineProtocol}");
                if (errorEvent.Exception.InnerException != null)
                {
                    Console.WriteLine($"  - Inner exception: {errorEvent.Exception.InnerException.Message}");
                }
                Console.WriteLine($"  - Stack trace: {errorEvent.Exception.StackTrace}");
                break;
            case WriteRetriableErrorEvent error:
                Console.WriteLine($"RETRIABLE ERROR: {error.Exception.Message}");
                Console.WriteLine($"  - Protocol: {error.LineProtocol}");
                if (error.Exception.InnerException != null)
                {
                    Console.WriteLine($"  - Inner exception: {error.Exception.InnerException.Message}");
                }
                break;
            case WriteRuntimeExceptionEvent error:
                Console.WriteLine($"💥 RUNTIME EXCEPTION: {error.Exception.Message}");
                Console.WriteLine($"  - Exception type: {error.Exception.GetType().Name}");
                Console.WriteLine($"  - Stack trace: {error.Exception.StackTrace}");
                if (error.Exception.InnerException != null)
                {
                    Console.WriteLine($"  - Inner exception: {error.Exception.InnerException.Message}");
                }
                break;
            default:
                Console.WriteLine($"📝 Unknown event: {eventArgs.GetType().Name}");
                break;
        }
    }
}