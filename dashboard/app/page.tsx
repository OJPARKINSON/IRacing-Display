"use client";
import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// This would be your imported telemetry data
// For production, you'd connect to the iRacing API directly
import data from "../data.json";

export default function TelemetryDashboard() {
  const [trackLeftPath, setTrackLeftPath] = useState<string | null>(null);
  const [trackRightPath, setTrackRightPath] = useState<string | null>(null);
  const [racingLinePath, setRacingLinePath] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>("Speed");
  const [telemetryData, setTelemetryData] = useState<any[]>([]);

  // 🔹 ADJUSTABLE PARAMETERS - Tuned for better visualization 🔹
  const trackWidth = 18; // Increased for better visibility
  const steeringMultiplier = 0.25; // Enhanced steering effect
  const velocityFactor = 0.12; // Better speed-based smoothing
  const kalmanFilterFactor = 0.004; // Improved steering smoothing
  const bezierSmoothingFactor = 0.0006; // Better curve rendering
  const trackBorderWidth = 3; // Track border line width
  const racingLineWidth = 4; // Racing line width - increased for visibility

  // Define available telemetry metrics
  const availableMetrics = [
    "Speed",
    "RPM",
    "Throttle",
    "Brake",
    "Gear",
    "LapDistPct",
    "SteeringWheelAngle",
  ];

  useEffect(() => {
    if (!data || !data.data || data.data.length === 0) {
      console.error("🚨 No telemetry data loaded!");
      return;
    }

    // Prepare telemetry data for charts
    setTelemetryData(
      data.data.map((d: any, i: number) => ({
        index: i,
        Speed: d.Speed,
        RPM: d.RPM,
        Throttle: d.Throttle * 100,
        Brake: d.Brake * 100,
        Gear: d.Gear,
        LapDistPct: d.LapDistPct * 100,
        SteeringWheelAngle: d.SteeringWheelAngle,
      }))
    );

    // Extract min/max Lat/Lon for scaling to match the provided image
    const minLat = Math.min(...data.data.map((d: any) => d.Lat));
    const maxLat = Math.max(...data.data.map((d: any) => d.Lat));
    const minLon = Math.min(...data.data.map((d: any) => d.Lon));
    const maxLon = Math.max(...data.data.map((d: any) => d.Lon));

    // Calculate scaling factors to fit the SVG viewport
    const viewBoxWidth = 800;
    const viewBoxHeight = 600;
    const paddingPercent = 0.05; // 5% padding around the track
    const padding = Math.max(
      viewBoxWidth * paddingPercent,
      viewBoxHeight * paddingPercent
    );

    // Enhanced scaling functions with padding
    const scaleX = (lon: number) =>
      ((lon - minLon) / (maxLon - minLon)) * (viewBoxWidth - 2 * padding) +
      padding;
    const scaleY = (lat: number) =>
      ((maxLat - lat) / (maxLat - minLat)) * (viewBoxHeight - 2 * padding) +
      padding;

    // Improved normal vector calculation for smoother track edges
    const getNormalVector = (index: number) => {
      if (index === 0 || index >= data.data.length - 1) {
        // Handle edge cases by using nearby points
        const nextIndex = index === 0 ? 1 : index - 1;
        const point = data.data[index];
        const nextPoint = data.data[nextIndex];
        const dx = scaleX(nextPoint.Lon) - scaleX(point.Lon);
        const dy = scaleY(nextPoint.Lat) - scaleY(point.Lat);
        const length = Math.sqrt(dx * dx + dy * dy);
        return {
          nx: (dy / length) * trackWidth,
          ny: (-dx / length) * trackWidth,
        };
      }

      // For normal points, use surrounding points for smoother normals
      const prev = data.data[Math.max(0, index - 1)];
      const curr = data.data[index];
      const next = data.data[Math.min(data.data.length - 1, index + 1)];

      // Calculate direction vectors
      const dx1 = scaleX(curr.Lon) - scaleX(prev.Lon);
      const dy1 = scaleY(curr.Lat) - scaleY(prev.Lat);
      const dx2 = scaleX(next.Lon) - scaleX(curr.Lon);
      const dy2 = scaleY(next.Lat) - scaleY(curr.Lat);

      // Average the two direction vectors
      const dx = (dx1 + dx2) / 2;
      const dy = (dy1 + dy2) / 2;
      const length = Math.sqrt(dx * dx + dy * dy);

      return {
        nx: (dy / length) * trackWidth,
        ny: (-dx / length) * trackWidth,
      };
    };

    // Apply Kalman Filter for smoother steering input
    let filteredSteering = [data.data[0].SteeringWheelAngle];
    for (let i = 1; i < data.data.length; i++) {
      const prev = filteredSteering[i - 1];
      const curr = data.data[i].SteeringWheelAngle;
      filteredSteering.push(prev + kalmanFilterFactor * (curr - prev));
    }

    // Generate track boundaries with improved smoothness
    const trackLeft = data.data.map((point: any, i: number) => {
      const { nx, ny } = getNormalVector(i);
      return `${scaleX(point.Lon) + nx},${scaleY(point.Lat) + ny}`;
    });

    const trackRight = data.data.map((point: any, i: number) => {
      const { nx, ny } = getNormalVector(i);
      return `${scaleX(point.Lon) - nx},${scaleY(point.Lat) - ny}`;
    });

    // Generate enhanced racing line with adaptive smoothing based on multiple factors
    const racingLine = data.data.map((point: any, i: number) => {
      const { nx, ny } = getNormalVector(i);

      // Use multiple telemetry inputs to create a realistic racing line
      const speedFactor = Math.max(
        0.3,
        1 - velocityFactor * Math.log(1 + point.Speed)
      );

      // Consider braking and throttle inputs
      const brakingFactor = point.Brake > 0.1 ? 1.5 : 1.0;
      const throttleFactor = point.Throttle > 0.8 ? 0.8 : 1.0;

      // Calculate lateral offset for racing line
      const offset =
        filteredSteering[i] *
        steeringMultiplier *
        trackWidth *
        speedFactor *
        brakingFactor *
        throttleFactor;

      return `${scaleX(point.Lon) + offset * nx},${
        scaleY(point.Lat) + offset * ny
      }`;
    });

    // Apply enhanced Bézier curve smoothing
    const smoothPath = (points: string[], factor: number) => {
      if (points.length < 2) return "";

      // Begin path with the first point
      let path = `M ${points[0]} `;

      // Apply a moving window approach for smoothing
      const windowSize = 5; // Use 5 points for smoothing window

      for (let i = 0; i < points.length - 1; i++) {
        const currPoint = points[i].split(",").map(parseFloat);
        const nextPoint = points[i + 1].split(",").map(parseFloat);

        // Calculate control points using surrounding points when available
        let prevPoint =
          i > 0
            ? points[i - 1].split(",").map(parseFloat)
            : [
                currPoint[0] - (nextPoint[0] - currPoint[0]),
                currPoint[1] - (nextPoint[1] - currPoint[1]),
              ];

        let nextNextPoint =
          i < points.length - 2
            ? points[i + 2].split(",").map(parseFloat)
            : [
                nextPoint[0] + (nextPoint[0] - currPoint[0]),
                nextPoint[1] + (nextPoint[1] - currPoint[1]),
              ];

        // Calculate control point positions
        const cp1x = currPoint[0] + (nextPoint[0] - prevPoint[0]) * factor;
        const cp1y = currPoint[1] + (nextPoint[1] - prevPoint[1]) * factor;
        const cp2x = nextPoint[0] - (nextNextPoint[0] - currPoint[0]) * factor;
        const cp2y = nextPoint[1] - (nextNextPoint[1] - currPoint[1]) * factor;

        // Add cubic Bezier curve segment
        path += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${nextPoint[0]},${nextPoint[1]} `;
      }

      return path;
    };

    // Set the paths
    setTrackLeftPath(`M ${trackLeft.join(" L ")}`);
    setTrackRightPath(`M ${trackRight.join(" L ")}`);
    setRacingLinePath(smoothPath(racingLine, bezierSmoothingFactor));
  }, [data]);

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">iRacing Telemetry Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Track Map (Larger on all screens) */}
        <div className="col-span-1 lg:col-span-2 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">
            Track Map & Racing Line
          </h2>
          <div className="bg-gray-800 p-2 rounded-lg relative">
            <svg
              className="w-full h-auto"
              viewBox="0 0 800 600"
              preserveAspectRatio="xMidYMid meet"
              style={{ backgroundColor: "#1a1a1a" }}
            >
              {/* Track boundaries */}
              {trackLeftPath && (
                <path
                  d={trackLeftPath}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth={trackBorderWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {trackRightPath && (
                <path
                  d={trackRightPath}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth={trackBorderWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Racing line */}
              {racingLinePath && (
                <path
                  d={racingLinePath}
                  fill="none"
                  stroke="#f56565" // Vibrant red like in the image
                  strokeWidth={racingLineWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Telemetry Charts */}
        <div className="col-span-1 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Telemetry Data</h2>

          <div className="mb-4">
            <label className="mr-2">Select Metric:</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-gray-700 text-white p-1 rounded"
            >
              {availableMetrics.map((metric) => (
                <option key={metric} value={metric}>
                  {metric}
                </option>
              ))}
            </select>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetryData}>
                <XAxis
                  dataKey="index"
                  stroke="#aaa"
                  tickFormatter={(value) => Math.floor(value / 10) * 10}
                  interval={Math.floor(telemetryData.length / 5)}
                />
                <YAxis stroke="#aaa" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#2d3748",
                    color: "white",
                    border: "none",
                  }}
                  formatter={(value) => [value, selectedMetric]}
                />
                <Line
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#f56565"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key Metrics */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {availableMetrics.slice(0, 4).map((metric) => (
              <div key={metric} className="bg-gray-700 p-2 rounded">
                <div className="text-sm text-gray-400">{metric}</div>
                <div className="text-lg font-bold">
                  {telemetryData.length > 0
                    ? telemetryData[telemetryData.length - 1][metric].toFixed(1)
                    : 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Telemetry Information */}
      <div className="mt-4 bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Telemetry Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-sm text-gray-400">Lap</div>
            <div className="text-xl font-bold">{data.data?.[0]?.Lap || 0}</div>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-sm text-gray-400">Lap Time</div>
            <div className="text-xl font-bold">
              {data.data?.[0]?.LapCurrentLapTime?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-sm text-gray-400">Position</div>
            <div className="text-xl font-bold">
              {data.data?.[0]?.PlayerCarPosition || 0}
            </div>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-sm text-gray-400">Fuel</div>
            <div className="text-xl font-bold">
              {data.data?.[0]?.FuelLevel?.toFixed(1) || 0} L
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
