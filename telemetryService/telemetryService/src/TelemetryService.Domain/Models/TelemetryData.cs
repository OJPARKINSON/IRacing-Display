namespace TelemetryService.Domain.Models;

public class TelemetryData
{
    public string? Car_id { get; set; }
    public double Brake { get; set; }
    public double Fuel_level { get; set; }
    public int Gear { get; set; }
    public string? Track_name { get; set; }
    public string? Track_id { get; set; }
    public double Lap_current_lap_time { get; set; }
    public double Lap_dist_pct { get; set; }
    public string? Lap_id { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public int Player_car_position { get; set; }
    public double Rpm { get; set; }
    public string? Session_id { get; set; }
    public string? Session_num { get; set; }
    public double Session_time { get; set; }
    public double Speed { get; set; }
    public double Steering_wheel_angle { get; set; }
    public double Throttle { get; set; }
    public string? Tick_time { get; set; }
    public double Velocity_x { get; set; }
    public double Velocity_y { get; set; }
    public double Velocity_Z { get; set; }
    public double Alt { get; set; }
    public double Lat_accel { get; set; }
    public double Long_accel { get; set; }
    public double Vert_accel { get; set; }
    public double Pitch { get; set; }
    public double Roll { get; set; }
    public double Yaw { get; set; }
    public double Yaw_north { get; set; }
    public double Voltage { get; set; }
    public double LapLastLapTime { get; set; }
    public double WaterTemp { get; set; }
    public double LapDeltaToBestLap { get; set; }
    public double LapCurrentLapTime { get; set; }
    public double LFpressure { get; set; }
    public double RFpressure { get; set; }
    public double LRpressure { get; set; }
    public double RRpressure { get; set; }
    public double LFtempM { get; set; }
    public double RFtempM { get; set; }
    public double LRtempM { get; set; }
    public double RRtempM { get; set; }
}
