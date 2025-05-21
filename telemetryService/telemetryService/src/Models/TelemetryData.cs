namespace TelemetryService.Models;

public class TelemetryData
{
    public int Car_id { get; set; }
    public double Brake { get; set; }
    public double Fuel_level { get; set; }
    public int Gear { get; set; }
    public double Lap_current_lap_time { get; set; }
    public double Lap_dist_pct { get; set; }
    public string Lap_id { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public int Player_car_position { get; set; }
    public double Rpm { get; set; }
    public string Session_id { get; set; }
    public string Session_num { get; set; }
    public double Session_time { get; set; }
    public double Speed { get; set; }
    public double Steering_wheel_angle { get; set; }
    public double Throttle { get; set; }
    public string Tick_time { get; set; }
    public double Velocity_x { get; set; }
    public double Velocity_y { get; set; }
}