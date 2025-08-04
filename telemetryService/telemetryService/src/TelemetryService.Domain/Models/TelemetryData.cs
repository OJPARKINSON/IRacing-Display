using System.Text.Json.Serialization;

namespace TelemetryService.Domain.Models;

public class TelemetryData
{
    [JsonPropertyName("car_id")]
    public string? Car_id { get; set; }

    [JsonPropertyName("brake")]
    public double Brake { get; set; }

    [JsonPropertyName("fuel_level")]
    public double Fuel_level { get; set; }

    [JsonPropertyName("gear")]
    public int Gear { get; set; }

    [JsonPropertyName("track_name")]
    public string? Track_name { get; set; }

    [JsonPropertyName("track_id")]
    public string? Track_id { get; set; }

    [JsonPropertyName("lap_current_lap_time")]
    public double Lap_current_lap_time { get; set; }

    [JsonPropertyName("lap_dist_pct")]
    public double Lap_dist_pct { get; set; }

    [JsonPropertyName("lap_id")]
    public string Lap_id { get; set; } = string.Empty;

    [JsonPropertyName("lat")]
    public double Lat { get; set; }

    [JsonPropertyName("lon")]
    public double Lon { get; set; }

    [JsonPropertyName("player_car_position")]
    public int Player_car_position { get; set; }

    [JsonPropertyName("rpm")]
    public double Rpm { get; set; }

    [JsonPropertyName("session_id")]
    public string? Session_id { get; set; }

    [JsonPropertyName("session_num")]
    public string? Session_num { get; set; }

    [JsonPropertyName("session_type")]
    public string? Session_type { get; set; }

    [JsonPropertyName("session_name")]
    public string? Session_name { get; set; }

    [JsonPropertyName("session_time")]
    public double Session_time { get; set; }

    [JsonPropertyName("speed")]
    public double Speed { get; set; }

    [JsonPropertyName("steering_wheel_angle")]
    public double Steering_wheel_angle { get; set; }

    [JsonPropertyName("throttle")]
    public double Throttle { get; set; }

    [JsonPropertyName("tick_time")]
    public string? Tick_time { get; set; }

    [JsonPropertyName("velocity_x")]
    public double Velocity_x { get; set; }

    [JsonPropertyName("velocity_y")]
    public double Velocity_y { get; set; }

    [JsonPropertyName("velocity_z")]
    public double Velocity_Z { get; set; }

    [JsonPropertyName("alt")]
    public double Alt { get; set; }

    [JsonPropertyName("lat_accel")]
    public double Lat_accel { get; set; }

    [JsonPropertyName("long_accel")]
    public double Long_accel { get; set; }

    [JsonPropertyName("vert_accel")]
    public double Vert_accel { get; set; }

    [JsonPropertyName("pitch")]
    public double Pitch { get; set; }

    [JsonPropertyName("roll")]
    public double Roll { get; set; }

    [JsonPropertyName("yaw")]
    public double Yaw { get; set; }

    [JsonPropertyName("yaw_north")]
    public double Yaw_north { get; set; }

    [JsonPropertyName("voltage")]
    public double Voltage { get; set; }

    [JsonPropertyName("lapLastLapTime")]
    public double LapLastLapTime { get; set; }

    [JsonPropertyName("waterTemp")]
    public double WaterTemp { get; set; }

    [JsonPropertyName("lapDeltaToBestLap")]
    public double LapDeltaToBestLap { get; set; }

    [JsonPropertyName("lFpressure")]
    public double LFpressure { get; set; }

    [JsonPropertyName("rFpressure")]
    public double RFpressure { get; set; }

    [JsonPropertyName("lRpressure")]
    public double LRpressure { get; set; }

    [JsonPropertyName("rRpressure")]
    public double RRpressure { get; set; }

    [JsonPropertyName("lFtempM")]
    public double LFtempM { get; set; }

    [JsonPropertyName("rFtempM")]
    public double RFtempM { get; set; }

    [JsonPropertyName("lRtempM")]
    public double LRtempM { get; set; }

    [JsonPropertyName("rRtempM")]
    public double RRtempM { get; set; }
}