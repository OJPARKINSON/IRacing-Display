import { TelemetryDataPoint, TelemetryResponse } from "./types";

export const fetcher = (url: string) => fetch(url).then((r) => r.json());

export const telemetryFetcher = (url: string) => {
  return fetch(url).then(async (r) => {
    if (!r.ok) {
      throw new Error(`Failed to fetch telemetry data: ${r.statusText}`);
    } else {
      const data = await r.json();

      return processData(data);
    }
  });
};

const processData = (data: TelemetryResponse) => {
  // Sort data by session_time to ensure correct order
  const sortedData = [...data.data].sort((a, b) => {
    const timeA = a.session_time !== undefined ? a.session_time : 0;
    const timeB = b.session_time !== undefined ? b.session_time : 0;
    return timeA - timeB;
  });

  // Prepare telemetry data for charts
  const processedData: TelemetryDataPoint[] = sortedData.map((d, i) => ({
    index: i,
    time: d._time || i,
    sessionTime: d.session_time || 0,
    Speed: d.speed || 0,
    RPM: d.rpm || 0,
    Throttle: (d.throttle || 0) * 100,
    Brake: (d.brake || 0) * 100,
    Gear: d.gear || 0,
    LapDistPct: (d.lap_dist_pct || 0) * 100,
    SteeringWheelAngle: d.steering_wheel_angle || 0,
    Lat: d.lat || 0,
    Lon: d.lon || 0,
    VelocityX: d.velocity_x || 0,
    VelocityY: d.velocity_y || 0,
    FuelLevel: d.fuel_level || 0,
    LapCurrentLapTime: d.lap_current_lap_time || 0,
    PlayerCarPosition: d.player_car_position || 0,
  }));

  return processedData;
};
