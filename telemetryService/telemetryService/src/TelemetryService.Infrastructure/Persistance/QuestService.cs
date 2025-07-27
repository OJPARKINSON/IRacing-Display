using QuestDB;
using QuestDB.Senders;
using TelemetryService.Domain.Models;

namespace TelemetryService.Infrastructure.Persistence;

public class QuestDbService
{
    private ISender? _sender;
    private QuestDbSchemaManager? _schemaManager;

    public QuestDbService()
    {
        string? url = Environment.GetEnvironmentVariable("QUESTDB_URL");

        if (url == null)
        {
            return;
        }

        _schemaManager = new QuestDbSchemaManager(url);

        _sender = Sender.New($"http::addr={url.Replace("http://", "")};auto_flush_rows=10000;auto_flush_interval=1000;");
        
        _ = Task.Run(async () => 
        {
            await Task.Delay(3000);
            await InitializeSchema();
        });
    }

    private async Task InitializeSchema()
    {
        if (_schemaManager == null) return;

        try
        {
            Console.WriteLine("🔧 Checking QuestDB schema optimization...");
            var success = await _schemaManager.EnsureOptimizedSchemaExists();
            
            if (success)
            {
                var stats = await _schemaManager.GetTableStats();
                Console.WriteLine("📊 TelemetryTicks schema status:");
                foreach (var stat in stats)
                {
                    Console.WriteLine($"   {stat.Key}: {stat.Value}");
                }
            }
            else
            {
                Console.WriteLine("⚠️  Schema optimization failed, using existing table structure");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Schema initialization warning: {ex.Message}");
        }
    }

    public async Task<bool> TriggerSchemaOptimization()
    {
        if (_schemaManager == null)
        {
            Console.WriteLine("⚠️  Schema manager not initialized");
            return false;
        }

        try
        {
            Console.WriteLine("🔧 Manually triggering schema optimization...");
            var result = await _schemaManager.EnsureOptimizedSchemaExists();
            
            if (result)
            {
                var stats = await _schemaManager.GetTableStats();
                Console.WriteLine("📊 Schema optimization status:");
                foreach (var stat in stats)
                {
                    Console.WriteLine($"   {stat.Key}: {stat.Value}");
                }
            }
            
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Manual schema optimization failed: {ex.Message}");
            return false;
        }
    }

    public void Dispose()
    {
        _sender?.Dispose();
        _schemaManager?.Dispose();
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

        try
        {
            foreach (var tel in telData)
            {
                _sender.Table("TelemetryTicks")
                    .Symbol("session_id", tel.Session_id)
                    .Symbol("track_name", tel.Track_name)
                    .Symbol("track_id", tel.Track_id)
                    
                    .Symbol("lap_id", tel.Lap_id ?? "unknown")
                    .Symbol("session_num", tel.Session_num)
                    
                    .Column("car_id", tel.Car_id)
                    
                    .Column("gear", tel.Gear)
                    .Column("player_car_position", tel.Player_car_position)
                    
                    .Column("speed", tel.Speed)
                    .Column("lap_dist_pct", tel.Lap_dist_pct)
                    .Column("session_time", tel.Session_time)
                    .Column("lat", tel.Lat)
                    .Column("lon", tel.Lon)
                    .Column("lap_current_lap_time", tel.Lap_current_lap_time)
                    .Column("lapLastLapTime", tel.LapLastLapTime)
                    .Column("lapDeltaToBestLap", tel.LapDeltaToBestLap)
                    
                    .Column("throttle", (float)tel.Throttle)
                    .Column("brake", (float)tel.Brake)
                    .Column("steering_wheel_angle", (float)tel.Steering_wheel_angle)
                    .Column("rpm", (float)tel.Rpm)
                    .Column("velocity_x", (float)tel.Velocity_x)
                    .Column("velocity_y", (float)tel.Velocity_y)
                    .Column("velocity_z", (float)tel.Velocity_Z)
                    .Column("fuel_level", (float)tel.Fuel_level)
                    .Column("alt", (float)tel.Alt)
                    .Column("lat_accel", (float)tel.Lat_accel)
                    .Column("long_accel", (float)tel.Long_accel)
                    .Column("vert_accel", (float)tel.Vert_accel)
                    .Column("pitch", (float)tel.Pitch)
                    .Column("roll", (float)tel.Roll)
                    .Column("yaw", (float)tel.Yaw)
                    .Column("yaw_north", (float)tel.Yaw_north)
                    .Column("voltage", (float)tel.Voltage)
                    .Column("waterTemp", (float)tel.WaterTemp)
                    .Column("lFpressure", (float)tel.LFpressure)
                    .Column("rFpressure", (float)tel.RFpressure)
                    .Column("lRpressure", (float)tel.LRpressure)
                    .Column("rRpressure", (float)tel.RRpressure)
                    .Column("lFtempM", (float)tel.LFtempM)
                    .Column("rFtempM", (float)tel.RFtempM)
                    .Column("lRtempM", (float)tel.LRtempM)
                    .Column("rRtempM", (float)tel.RRtempM)
                    .At(DateTime.Parse(tel.Tick_time ?? DateTime.UtcNow.ToString("O")));
            }
            
            await _sender.SendAsync();
            Console.WriteLine($"Successfully wrote {telData.Count} telemetry points");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR writing to QuestDB: {ex.Message}");
        }
    }
}