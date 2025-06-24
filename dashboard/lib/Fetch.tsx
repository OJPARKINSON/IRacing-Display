import { TelemetryDataPoint, TelemetryResponse } from "./types";

export const fetcher = (url: string) => fetch(url).then((r) => r.json());

export const telemetryFetcher = (url: string) => {
	return fetch(url).then(async (r) => {
		if (!r.ok) {
			throw new Error(`Failed to fetch telemetry data: ${r.statusText}`);
		} else {
			const data = await r.json();
			return processIRacingData(data);
		}
	});
};

const processIRacingData = (data: TelemetryResponse) => {
	const sortedData = [...data.data].sort((a, b) => {
		const timeA = a.session_time !== undefined ? a.session_time : 0;
		const timeB = b.session_time !== undefined ? b.session_time : 0;
		return timeA - timeB;
	});

	const processedData: TelemetryDataPoint[] = sortedData.map((d, i) => ({
		index: i,
		time: d._time || i,
		sessionTime: d.session_time || 0,

		Speed: d.speed ? d.speed * 3.6 : 0,

		RPM: d.rpm || 0,

		Throttle: d.throttle ? d.throttle * 100 : 0,
		Brake: d.brake ? d.brake * 100 : 0,

		Gear: d.gear || 0,

		LapDistPct: d.lap_dist_pct ? d.lap_dist_pct * 100 : 0,

		SteeringWheelAngle: d.steering_wheel_angle || 0,

		Lat: d.lat || 0,
		Lon: d.lon || 0,

		VelocityX: d.velocity_x || 0,
		VelocityY: d.velocity_y || 0,
		VelocityZ: d.velocity_z || 0,

		FuelLevel: d.fuel_level || 0,
		LapCurrentLapTime: d.lap_current_lap_time || 0,
		PlayerCarPosition: d.player_car_position || 0,
		TrackName: d.track_name || "",
		SessionNum: d.session_num || "",

		LatAccel: d.lat_accel || 0,
		LongAccel: d.long_accel || 0,
		VertAccel: d.vert_accel || 0,

		Alt: d.alt || 0,

		Pitch: d.pitch || 0,
		Roll: d.roll || 0,
		Yaw: d.yaw || 0,
		YawNorth: d.yaw_north || 0,
	}));

	return processedData;
};