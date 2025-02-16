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
import data from "../data.json"; // iRacing telemetry JSON

export default function TelemetryDashboard() {
  const [trackLeftPath, setTrackLeftPath] = useState<string | null>(null);
  const [trackRightPath, setTrackRightPath] = useState<string | null>(null);
  const [racingLinePath, setRacingLinePath] = useState<string | null>(null);

  // 🔹 ADJUSTABLE PARAMETERS 🔹
  const trackWidth = 15; // Keep track width constant
  const steeringMultiplier = 0.2; // Reduce lateral deviation for stability
  const velocityFactor = 0.1; // Smooth movement at higher speeds
  const rollingAverageWindow = 10; // Increase to stabilize inputs
  const kalmanFilterFactor = 0.002; // Smoother steering correction
  const bezierSmoothingFactor = 0.0004; // Adjusts Bézier curve smoothness
  const trajectorySmoothingFactor = 0.1; // Adjusts overall trajectory smoothing

  useEffect(() => {
    if (!data || !data.data || data.data.length === 0) {
      console.error(
        "🚨 No data loaded! Check if the JSON file is correctly imported."
      );
      return;
    }

    // Extract min/max Lat/Lon for scaling
    const minLat = Math.min(...data.data.map((d) => d.Lat));
    const maxLat = Math.max(...data.data.map((d) => d.Lat));
    const minLon = Math.min(...data.data.map((d) => d.Lon));
    const maxLon = Math.max(...data.data.map((d) => d.Lon));

    console.log("Scale Debugging - Min/Max Values:", {
      minLat,
      maxLat,
      minLon,
      maxLon,
    });

    const scaleX = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * 1920;
    const scaleY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * 1080;

    // Function to get normal vector for track width
    const getNormalVector = (index: number) => {
      if (index === 0 || index >= data.data.length - 1) return { nx: 0, ny: 0 };
      const prev = data.data[index - 1];
      const next = data.data[index + 1];
      const dx = scaleX(next.Lon) - scaleX(prev.Lon);
      const dy = scaleY(next.Lat) - scaleY(prev.Lat);
      const length = Math.sqrt(dx * dx + dy * dy);
      return {
        nx: (dy / length) * trackWidth,
        ny: (-dx / length) * trackWidth,
      };
    };

    // Apply Kalman Filter to smooth steering fluctuations
    let filteredSteering = [data.data[0].SteeringWheelAngle];
    for (let i = 1; i < data.data.length; i++) {
      const prev = filteredSteering[i - 1];
      const curr = data.data[i].SteeringWheelAngle;
      filteredSteering.push(prev + kalmanFilterFactor * (curr - prev)); // Weighted filter
    }

    // Generate left & right track boundaries
    const trackLeft = data.data.map((point, i) => {
      const { nx, ny } = getNormalVector(i);
      return `${scaleX(point.Lon) + nx},${scaleY(point.Lat) + ny}`;
    });

    const trackRight = data.data.map((point, i) => {
      const { nx, ny } = getNormalVector(i);
      return `${scaleX(point.Lon) - nx},${scaleY(point.Lat) - ny}`;
    });

    // Generate racing line with adaptive smoothing
    const racingLine = data.data.map((point, i) => {
      const { nx, ny } = getNormalVector(i);
      const speedFactor = Math.max(
        0.3,
        1 - velocityFactor * Math.log(1 + point.Speed)
      );
      const brakingFactor = point.Brake > 0 ? 1.2 : 1.0; // Adjust for braking
      const offset =
        filteredSteering[i] *
        steeringMultiplier *
        trackWidth *
        speedFactor *
        brakingFactor;
      return `${scaleX(point.Lon) + offset * nx},${
        scaleY(point.Lat) + offset * ny
      }`;
    });

    // Apply Bézier curve smoothing to racing line
    const smoothPath = (points: string[], factor: number) => {
      if (points.length < 2) return ""; // Ensure at least two points exist

      return (
        `M ${points[0]} ` +
        points
          .map((p, i, arr) => {
            if (i === 0 || i === arr.length - 1) return `${p}`; // Keep first and last as is
            const prev = arr[i - 1].split(",");
            const next = arr[i + 1].split(",");
            const px = parseFloat(prev[0]);
            const py = parseFloat(prev[1]);
            const nx = parseFloat(next[0]);
            const ny = parseFloat(next[1]);
            const cx = px + (nx - px) * factor;
            const cy = py + (ny - py) * factor;
            return `Q ${cx},${cy} ${p}`;
          })
          .join(" ")
      );
    };

    setTrackLeftPath(`M ${trackLeft.join(" L ")}`);
    setTrackRightPath(`M ${trackRight.join(" L ")}`);
    setRacingLinePath(smoothPath(racingLine, bezierSmoothingFactor));
  }, [data]);

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">iRacing Telemetry Dashboard</h1>
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 p-2">
          <h2 className="text-xl font-semibold">Track Map & Racing Line</h2>
          <div className="bg-gray-800 p-4 rounded-lg relative">
            <svg
              className="w-full h-auto"
              viewBox="0 0 1920 1080"
              preserveAspectRatio="xMidYMid meet"
            >
              {trackLeftPath && (
                <path
                  d={trackLeftPath}
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {trackRightPath && (
                <path
                  d={trackRightPath}
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {racingLinePath && (
                <path
                  d={racingLinePath}
                  fill="none"
                  stroke="red"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
