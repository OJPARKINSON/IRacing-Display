"use client";
import React, { useEffect, useState, useRef } from "react";
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
  const [svgContent, setSvgContent] = useState(""); // Store full SVG
  const [racingLinePath, setRacingLinePath] = useState<string | null>(null); // Racing line path
  const trackRef = useRef<SVGPathElement | null>(null);
  const [pathLoaded, setPathLoaded] = useState(false);

  // 🔹 ADJUSTABLE PARAMETERS 🔹
  const lapScalingFactor = 100.0; // Ensures full lap coverage
  const steeringMultiplier = 0.02; // Adjust lateral movement
  let xOffset = 50; // Fine-tune horizontal alignment
  let yOffset = 72; // Fine-tune vertical alignment
  let xScale = 0.92; // Scale X separately
  let yScale = 0.92; // Scale Y separately
  const velocityFactor = 0.5; // Adjusts the effect of velocity on racing line

  useEffect(() => {
    // Fetch and load SVG track map
    fetch("/monza.svg")
      .then((response) => response.text())
      .then((svgText) => {
        setSvgContent(svgText);
      })
      .catch((error) => console.error("Error loading SVG:", error));
  }, []);

  useEffect(() => {
    if (!svgContent) return;

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(svgContent, "image/svg+xml");
    const pathElement = xmlDoc.querySelector("path");

    if (pathElement) {
      trackRef.current = pathElement as unknown as SVGPathElement;
      setPathLoaded(true);

      // Extract bounding box of track path
      const bbox = pathElement.getBBox();
      console.log("Track BBox:", bbox);

      // Use this to calculate adjustments
      xOffset = -bbox.x; // Center horizontally
      yOffset = -bbox.y; // Center vertically
      xScale = 1920 / bbox.width; // Normalize width
      yScale = 1080 / bbox.height; // Normalize height
    }
  }, [svgContent]);

  useEffect(() => {
    if (!pathLoaded || !trackRef.current) return;

    const trackPath = trackRef.current;
    const pathLength = trackPath.getTotalLength();

    if (pathLength === 0) {
      console.warn("SVG track path is empty or not ready.");
      return;
    }

    // 🔹 Generate racing line by mapping LapDistPct to the actual Monza track SVG path
    const newPath = data.data
      .map((point) => {
        // Convert LapDistPct to a point on the track path
        const lapPercentage = Math.max(
          0,
          Math.min(point.LapDistPct * lapScalingFactor, 100)
        );
        const trackPoint = trackPath.getPointAtLength(
          (lapPercentage / 100) * pathLength
        );

        // Apply velocity-based adjustment
        const velocityXAdj = point.VelocityX * velocityFactor;
        const velocityYAdj = point.VelocityY * velocityFactor;

        // Apply lateral offset using SteeringWheelAngle
        const lateralOffset = point.SteeringWheelAngle * steeringMultiplier;

        // ✅ Apply transformations for correct alignment
        const adjustedX =
          trackPoint.x * xScale + lateralOffset + velocityXAdj + xOffset;
        const adjustedY = trackPoint.y * yScale + velocityYAdj + yOffset;

        return `${adjustedX},${adjustedY}`;
      })
      .join(" ");

    // ✅ Convert point list to a valid SVG path format
    const formattedPath = `M${newPath.replace(/ /g, " L")}`;
    setRacingLinePath(formattedPath);
  }, [pathLoaded, data]);

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">iRacing Telemetry Dashboard</h1>

      <div className="flex flex-col md:flex-row">
        {/* SVG Track Map with Racing Line */}
        <div className="w-full md:w-1/2 p-2">
          <h2 className="text-xl font-semibold">Track Map & Racing Line</h2>
          <div className="bg-gray-800 p-4 rounded-lg relative">
            {/* Render Track SVG */}
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              viewBox="0 0 1920 1080"
              preserveAspectRatio="xMidYMid meet"
              dangerouslySetInnerHTML={{ __html: svgContent }} // Inline SVG
            />

            {/* Overlay Racing Line - Ensuring it Renders Above Track */}
            {pathLoaded && racingLinePath && (
              <svg
                className="absolute top-0 left-0 w-full h-auto"
                viewBox="0 0 1920 1080"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Racing Line - Rendered on Top of the Track */}
                <path
                  d={racingLinePath}
                  fill="none"
                  stroke="red" // Explicit Red Color
                  strokeWidth="3" // Ensure thickness for visibility
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Telemetry Graphs */}
        <div className="w-full md:w-1/2 p-2">
          <h2 className="text-xl font-semibold">Telemetry Data</h2>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.data}>
              <XAxis dataKey="LapDistPct" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="Speed"
                stroke="#8884d8"
                name="Speed (km/h)"
              />
            </LineChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.data}>
              <XAxis dataKey="LapDistPct" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="Throttle"
                stroke="#82ca9d"
                name="Throttle (%)"
              />
              <Line
                type="monotone"
                dataKey="Brake"
                stroke="#ff7300"
                name="Brake (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
