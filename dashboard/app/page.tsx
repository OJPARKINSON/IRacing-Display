"use client";

import React, { useState, useMemo } from "react";
import telemetryData from "../data.json";

const MapSVG = () => {
  const width = 800;
  const height = 600;
  const margin = 20;
  const trackWidth = 25;
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  // Memoize track and racing data processing to prevent recalculations
  const trackCoords = useMemo(
    () => telemetryData.data.map(({ Lat, Lon }) => ({ Lat, Lon })),
    [telemetryData.data]
  );

  const racingCoords = useMemo(
    () =>
      telemetryData.data.map(
        ({ Lat, Lon, SteeringWheelAngle, ThrottleRaw, Brake, Gear, RPM }) => ({
          Lat,
          Lon,
          SteeringWheelAngle,
          Speed: 0,
          Throttle: ThrottleRaw,
          Brake,
          Gear,
          RPM,
        })
      ),
    [telemetryData.data]
  );

  const minMaxValues = useMemo(() => {
    const minLat = Math.min(...trackCoords.map((p) => p.Lat));
    const maxLat = Math.max(...trackCoords.map((p) => p.Lat));
    const minLon = Math.min(...trackCoords.map((p) => p.Lon));
    const maxLon = Math.max(...trackCoords.map((p) => p.Lon));
    return { minLat, maxLat, minLon, maxLon };
  }, [trackCoords]);

  const convertToSVGCoords = (lat: number, lon: number) => {
    return {
      x:
        ((lon - minMaxValues.minLon) /
          (minMaxValues.maxLon - minMaxValues.minLon)) *
        width,
      y:
        height -
        ((lat - minMaxValues.minLat) /
          (minMaxValues.maxLat - minMaxValues.minLat)) *
          height,
    };
  };

  const trackEdges = useMemo(
    () => trackCoords.map(({ Lat, Lon }) => convertToSVGCoords(Lat, Lon)),
    [trackCoords, convertToSVGCoords]
  );

  const racingLine = useMemo(
    () =>
      racingCoords.map(({ Lat, Lon, SteeringWheelAngle }, i) => {
        const { x, y } = convertToSVGCoords(Lat, Lon);
        const angleFactor = SteeringWheelAngle * 0.05;
        if (i > 0 && i < racingCoords.length - 1) {
          const prev = convertToSVGCoords(
            racingCoords[i - 1].Lat,
            racingCoords[i - 1].Lon
          );
          const next = convertToSVGCoords(
            racingCoords[i + 1].Lat,
            racingCoords[i + 1].Lon
          );
          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          return {
            x: x + (dy / length) * angleFactor,
            y: y - (dx / length) * angleFactor,
          };
        }
        return { x, y };
      }),
    [racingCoords, convertToSVGCoords]
  );

  return (
    <div style={{ margin: "20px" }}>
      <svg
        width={width + margin * 2}
        height={height + margin * 2}
        viewBox={`-${margin} -${margin} ${width + margin * 2} ${
          height + margin * 2
        }`}
        style={{ border: "1px solid black", background: "#111" }}
      >
        {/* Track shape */}
        <polygon
          points={trackEdges.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill="black"
          stroke="gray"
          strokeWidth="10"
        />

        {/* Racing line */}
        <polyline
          points={racingLine.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="red"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive points */}
        {racingCoords.map((point, index) => {
          const { x, y } = convertToSVGCoords(point.Lat, point.Lon);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={selectedPoint === index ? 6 : 3}
              fill="red"
              onClick={() => setSelectedPoint(index)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
      </svg>
      {selectedPoint !== null && (
        <div
          style={{
            color: "white",
            background: "#222",
            padding: "10px",
            marginTop: "10px",
            borderRadius: "5px",
          }}
        >
          <h3>Telemetry Data</h3>
          <p>Speed: {racingCoords[selectedPoint].Speed} km/h</p>
          <p>Throttle: {racingCoords[selectedPoint].Throttle}%</p>
          <p>Brake: {racingCoords[selectedPoint].Brake}%</p>
          <p>Gear: {racingCoords[selectedPoint].Gear}</p>
          <p>RPM: {racingCoords[selectedPoint].RPM}</p>
          <p>
            Steering Angle: {racingCoords[selectedPoint].SteeringWheelAngle}°
          </p>
        </div>
      )}
    </div>
  );
};

export default function DashboardPage() {
  return (
    <div>
      <h2 style={{ marginLeft: "20px" }}>Track Layout with Racing Line</h2>
      <MapSVG />
    </div>
  );
}
