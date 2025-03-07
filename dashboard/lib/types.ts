export interface SessionInfo {
  id: string;
  bucket: string;
}

// Type for telemetry data point
export interface TelemetryDataPoint {
  index: number;
  time: number;
  sessionTime: number;
  Speed: number;
  RPM: number;
  Throttle: number;
  Brake: number;
  Gear: number;
  LapDistPct: number;
  SteeringWheelAngle: number;
  Lat: number;
  Lon: number;
  VelocityX: number;
  VelocityY: number;
  FuelLevel: number;
  LapCurrentLapTime: number;
  PlayerCarPosition: number;
  coordinates?: [number, number]; // Added for storing calculated coordinates
}

// Type for raw telemetry data from API
interface RawTelemetryData {
  _time?: number;
  session_time?: number;
  speed?: number;
  rpm?: number;
  throttle?: number;
  brake?: number;
  gear?: number;
  lap_dist_pct?: number;
  steering_wheel_angle?: number;
  lat?: number;
  lon?: number;
  velocity_x?: number;
  velocity_y?: number;
  fuel_level?: number;
  lap_current_lap_time?: number;
  player_car_position?: number;
}

// Type for telemetry response from API
export interface TelemetryResponse {
  data: RawTelemetryData[];
}
