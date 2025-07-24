using QuestDB;
using QuestDB.Senders;
using TelemetryService.Domain.Models;

namespace TelemetryService.Infrastructure.Persistence;

public class QuestDbService
{
    private ISender? _sender;

    public QuestDbService()
    {
        string? url = Environment.GetEnvironmentVariable("QUESTDB_URL");

        if (url == null)
        {
            return;
        }

        _sender = Sender.New($"http::addr={url.Replace("http://", "")};");
    }

    public void Dispose()
    {
        _sender?.Dispose();
    }

    public async Task WriteTick(List<TelemetryData>? telData)
    {
        if (telData == null || telData.Count == 0)
        {
            Console.WriteLine("No telemetry data to write");
            return;
        }

        if (_sender == null)
        {
            Console.WriteLine("ERROR: QuestDB sender is not initialized");
            return;
        }

        foreach (var tel in telData)
        {
            await _sender.Table("TelemetryTicks")
                .Symbol("lap_id", tel.Lap_id ?? "unknown")
                .Symbol("session_id", tel.Session_id)
                .Symbol("track_name", tel.Track_name)
                .Symbol("track_id", tel.Track_id)
                .Symbol("session_num", tel.Session_num)
                .Symbol("gear", tel.Gear.ToString())
                .Column("car_id", tel.Car_id)
                .Column("speed", tel.Speed)
                .Column("lap_dist_pct", tel.Lap_dist_pct)
                .Column("session_time", tel.Session_time)
                .Column("lap_current_lap_time", tel.Lap_current_lap_time)
                .Column("brake", tel.Brake)
                .Column("throttle", tel.Throttle)
                .Column("rpm", tel.Rpm)
                .Column("steering_wheel_angle", tel.Steering_wheel_angle)
                .Column("velocity_x", tel.Velocity_x)
                .Column("velocity_y", tel.Velocity_y)
                .Column("velocity_z", tel.Velocity_Z)
                .Column("lat", tel.Lat)
                .Column("lon", tel.Lon)
                .Column("player_car_position", tel.Player_car_position)
                .Column("fuel_level", tel.Fuel_level)
                .Column("alt", tel.Alt)
                .Column("lat_accel", tel.Lat_accel)
                .Column("long_accel", tel.Long_accel)
                .Column("vert_accel", tel.Vert_accel)
                .Column("pitch", tel.Pitch)
                .Column("roll", tel.Roll)
                .Column("yaw", tel.Yaw)
                .Column("yaw_north", tel.Yaw_north)
                .Column("voltage", tel.Voltage)
                .Column("lapLastLapTime", tel.LapLastLapTime)
                .Column("waterTemp", tel.WaterTemp)
                .Column("lapDeltaToBestLap", tel.LapDeltaToBestLap)
                .Column("lFpressure", tel.LFpressure)
                .Column("rFpressure", tel.RFpressure)
                .Column("lRpressure", tel.LRpressure)
                .Column("rRpressure", tel.RRpressure)
                .Column("lFtempM", tel.LFtempM)
                .Column("rFtempM", tel.RFtempM)
                .Column("lRtempM", tel.LRtempM)
                .Column("rRtempM", tel.RRtempM)
                .AtAsync(DateTime.Parse(tel.Tick_time));

        }
        try
        {
            await _sender.SendAsync();
            Console.WriteLine($"Successfully wrote {telData.Count} telemetry points");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR writing to QuestDB: {ex.Message}");
        }
    }
}