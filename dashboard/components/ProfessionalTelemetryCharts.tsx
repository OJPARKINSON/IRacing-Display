"use client";

import React, { useCallback, useMemo, useRef, useEffect } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	XAxis,
	YAxis,
	ReferenceLine,
	Tooltip,
} from "recharts";
import type { TelemetryDataPoint } from "@/lib/types";

interface ProfessionalTelemetryChartsProps {
	telemetryData: TelemetryDataPoint[];
	selectedIndex: number;
	onHover: (index: number) => void;
	onIndexChange: (index: number) => void;
	onMouseLeave?: () => void;
}

const ProfessionalTelemetryCharts = React.memo(function ProfessionalTelemetryCharts({
	telemetryData,
	selectedIndex,
	onHover,
	onIndexChange,
	onMouseLeave,
}: ProfessionalTelemetryChartsProps) {
	const chartData = useMemo(() => {
		// Sample data for better performance - show every 10th point for charts
		// This reduces 39K points to ~4K points for rendering while maintaining shape
		const sampleRate = Math.max(1, Math.floor(telemetryData.length / 4000));
		const sampledData = telemetryData.filter((_, index) => index % sampleRate === 0);
		
		return sampledData.map((point, index) => ({
			...point,
			originalIndex: telemetryData.indexOf(point), // Keep original index for interactions
			index: index,
			lapDistance: (point.LapDistPct / 100) * 5.5, // Approximate track distance in km
		}));
	}, [telemetryData]);

	// Throttle hover events for better performance
	const throttledHoverRef = useRef<number | null>(null);
	const lastHoverIndex = useRef<number>(-1);

	// Cleanup throttled events on unmount
	useEffect(() => {
		return () => {
			if (throttledHoverRef.current) {
				cancelAnimationFrame(throttledHoverRef.current);
			}
		};
	}, []);

	const handleMouseMove = useCallback(
		(data: any) => {
			if (data && data.activeTooltipIndex !== undefined && chartData[data.activeTooltipIndex]) {
				const originalIndex = chartData[data.activeTooltipIndex].originalIndex;
				
				// Skip if same index to prevent unnecessary updates
				if (lastHoverIndex.current === originalIndex) return;
				
				// Throttle hover events to 30fps (33ms) for better performance
				if (throttledHoverRef.current) {
					cancelAnimationFrame(throttledHoverRef.current);
				}
				throttledHoverRef.current = requestAnimationFrame(() => {
					lastHoverIndex.current = originalIndex;
					onHover(originalIndex);
				});
			}
		},
		[onHover, chartData],
	);

	const handleChartClick = useCallback(
		(data: any) => {
			if (data && data.activeTooltipIndex !== undefined && chartData[data.activeTooltipIndex]) {
				// Use original index from the sampled data
				const originalIndex = chartData[data.activeTooltipIndex].originalIndex;
				onIndexChange(originalIndex);
			}
		},
		[onIndexChange, chartData],
	);

	// Memoize chart configurations to prevent recreations
	const chartConfigs = useMemo(() => [
		{
			title: "Speed",
			dataKey: "Speed",
			color: "#ef4444",
			unit: "km/h",
			yDomain: [0, 300],
			height: 120,
		},
		{
			title: "Throttle",
			dataKey: "Throttle",
			color: "#22c55e",
			unit: "%",
			yDomain: [0, 100],
			height: 100,
		},
		{
			title: "Brake",
			dataKey: "Brake",
			color: "#f97316",
			unit: "%",
			yDomain: [0, 100],
			height: 100,
		},
		{
			title: "Gear",
			dataKey: "Gear",
			color: "#8b5cf6",
			unit: "",
			yDomain: [0, 8],
			height: 80,
		},
		{
			title: "RPM",
			dataKey: "RPM",
			color: "#06b6d4",
			unit: "",
			yDomain: [0, 8000],
			height: 100,
		},
		{
			title: "Steering",
			dataKey: "SteeringWheelAngle",
			color: "#ec4899",
			unit: "deg",
			yDomain: [-180, 180],
			height: 100,
		},
	], []);

	// Memoize tooltip component
	const CustomTooltip = useCallback(({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const dataPoint = payload[0].payload as TelemetryDataPoint & { lapDistance?: number };
			return (
				<div className="bg-zinc-800 border border-zinc-600 p-2 rounded shadow-lg">
					<p className="text-xs text-zinc-300">
						Distance: {dataPoint.lapDistance?.toFixed(2)} km
					</p>
					<p className="text-xs text-zinc-300">
						Time: {dataPoint.sessionTime?.toFixed(2)}s
					</p>
				</div>
			);
		}
		return null;
	}, []);

	return (
		<div 
			className="flex flex-col space-y-3"
			onMouseLeave={onMouseLeave}
		>
			<div className="text-sm font-medium text-white mb-2">
				Telemetry Data
			</div>
			
			{chartConfigs.map((config) => (
				<div key={config.dataKey} className="bg-zinc-900/30 rounded-lg p-3">
					<div className="flex justify-between items-center mb-2">
						<span className="text-xs font-medium text-zinc-300">
							{config.title}
						</span>
						<span className="text-xs text-zinc-500">{config.unit}</span>
					</div>
					
					<div style={{ height: config.height }}>
						<ResponsiveContainer width="100%" height="100%">
							<LineChart
								data={chartData}
								onMouseMove={handleMouseMove}
								onClick={handleChartClick}
								margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
								syncId="telemetry-charts"
							>
								<CartesianGrid 
									strokeDasharray="3 3" 
									stroke="#374151" 
									opacity={0.3}
								/>
								<XAxis
									dataKey="lapDistance"
									domain={[0, 5.5]}
									type="number"
									scale="linear"
									tick={{ fill: "#9ca3af", fontSize: 10 }}
									axisLine={{ stroke: "#374151" }}
									tickLine={{ stroke: "#374151" }}
									hide
								/>
								<YAxis
									domain={config.yDomain}
									tick={{ fill: "#9ca3af", fontSize: 10 }}
									axisLine={{ stroke: "#374151" }}
									tickLine={{ stroke: "#374151" }}
									width={35}
								/>
								<Tooltip content={<CustomTooltip />} />
								
								<Line
									type="monotone"
									dataKey={config.dataKey}
									stroke={config.color}
									strokeWidth={1.5}
									dot={false}
									isAnimationActive={false}
									connectNulls={false}
								/>
								
								{/* Reference line for selected position - only render when needed */}
								{selectedIndex >= 0 && selectedIndex < chartData.length && chartData[selectedIndex]?.lapDistance !== undefined && (
									<ReferenceLine
										x={chartData[selectedIndex].lapDistance}
										stroke="#ffffff"
										strokeWidth={1}
										strokeDasharray="2 2"
									/>
								)}
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>
			))}
			
			{/* Distance markers */}
			<div className="flex justify-between text-xs text-zinc-500 px-3 mt-2">
				<span>0 km</span>
				<span>1 km</span>
				<span>2 km</span>
				<span>3 km</span>
				<span>4 km</span>
				<span>5 km</span>
			</div>
		</div>
	);
});

ProfessionalTelemetryCharts.displayName = 'ProfessionalTelemetryCharts';

export default ProfessionalTelemetryCharts;