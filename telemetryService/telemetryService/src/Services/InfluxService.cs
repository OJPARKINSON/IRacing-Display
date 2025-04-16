using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;
using TelemetryService.Models;

namespace TelemetryService.Services
{
    public class InfluxService
    {
        public async Task WriteTicks(List<TelemetryData> telData)
        {
            string? url = Environment.GetEnvironmentVariable("INFLUX_URL");
            string? token = Environment.GetEnvironmentVariable("INFLUX_TOKEN");
            using var client = new InfluxDBClient(url, token);
            
            var getReady = client.ReadyAsync().WaitAsync(TimeSpan.FromSeconds(10));
            var ping = client.PingAsync().WaitAsync(TimeSpan.FromSeconds(10));
            Console.WriteLine($"InfluxDB ready: {getReady.GetAwaiter().GetResult()}");
            Console.WriteLine($"InfluxDB ping: {ping.GetAwaiter().GetResult()}");
            
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
                
                writeApi.WritePoints(pointData, "telemetry", "myorg"); 
                
                writeApi.Flush();
                
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
            }
        }
    }
}