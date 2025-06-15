namespace ingest.Models;

public struct TelemetryData
{
    public float? Gear { get; set; }
    public float IsOnTrackCar { get; set; }
    public float Rpm { get; set; }
    public float Speed { get; set; }
    public float BrakeRaw { get; set; }
    public int Lap { get; set; }
    public float LapDistPct { get; set; }
    public float SteeringWheelAngle { get; set; }
    public float VelocityY { get; set; }
    public double VelocityX { get; set; }
    public float Lat { get; set; }
    public float Lon { get; set; }
    public float SessionTime { get; set; }
    public float LapCurrentLapTime { get; set; }
    public float PlayerCarPosition { get; set; }
    public float FuelLevel { get; set; }
}