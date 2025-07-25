"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { InfoBox, TelemetryChart } from "@/components/InfoBox";
import TrackView from "@/components/TrackView";
import { useTrackPosition } from "@/hooks/useTrackPosition";
import type { TelemetryRes } from "@/lib/Fetch";
import type { TelemetryDataPoint } from "@/lib/types";

interface TelemetryPageProps {
	initialTelemetryData: TelemetryRes;
	availableLaps: Array<{ lap_id: number }>;
	sessionId: string;
	currentLapId: number;
}

const availableMetrics: string[] = [
	"LapDistPct",
	"Speed",
	"Throttle",
	"Brake",
	"Gear",
	"RPM",
	"SteeringWheelAngle",
	"LapCurrentLapTime",
	"PlayerCarPosition",
	"FuelLevel",
];

export default function TelemetryPage({
	initialTelemetryData,
	availableLaps,
	sessionId,
	currentLapId,
}: TelemetryPageProps) {
	const router = useRouter();
	const pathname = usePathname();

	const [selectedMetric, setSelectedMetric] = useState<string>("Speed");
	const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

	// Extract processed data from the server response - wrap in useMemo to fix dependency warning
	const dataWithGPSCoordinates = useMemo(() => {
		return initialTelemetryData?.dataWithGPSCoordinates || [];
	}, [initialTelemetryData?.dataWithGPSCoordinates]);

	const trackBounds = initialTelemetryData?.trackBounds || null;
	const processError = initialTelemetryData?.processError || null;

	const {
		selectedIndex,
		selectedLapPct,
		handlePointSelection,
		getTrackDisplayPoint,
	} = useTrackPosition(dataWithGPSCoordinates as TelemetryDataPoint[]);

	// Derive track information from data
	const trackInfo = useMemo(() => {
		if (dataWithGPSCoordinates.length === 0) return null;

		const firstPoint = dataWithGPSCoordinates[0];
		return {
			trackName: firstPoint?.TrackName || "Unknown Track",
			sessionNum: firstPoint?.SessionNum || sessionId,
		};
	}, [dataWithGPSCoordinates, sessionId]);

	const handleTrackPointClick = (index: number) => {
		handlePointSelection(index);
		setIsScrubbing(true);
		setTimeout(() => setIsScrubbing(false), 500);
	};

	const handleLapChange = (newLapId: string) => {
		const params = new URLSearchParams();
		params.set("lapId", newLapId);
		router.push(pathname + "?" + params.toString());
	};

	if (processError) {
		return (
			<div className="p-4 bg-gray-900 text-white min-h-screen">
				<div className="bg-red-900 text-white m-4 p-4 rounded">
					<p className="font-semibold">Error Loading Telemetry Data</p>
					<p>{processError}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 bg-gray-900 text-white min-h-screen">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-bold">iRacing Telemetry Dashboard</h1>
				<SessionInfo
					sessionId={sessionId}
					currentLapId={currentLapId}
					availableLaps={availableLaps}
					onLapChange={handleLapChange}
				/>
			</div>

			{/* Track Information */}
			<div className="mb-4 bg-gray-800 p-4 rounded-lg">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<h3 className="text-lg font-semibold text-blue-400">
							Track Information
						</h3>
						<p className="text-gray-300">Name: {trackInfo?.trackName}</p>
						<p className="text-gray-300">Session: {trackInfo?.sessionNum}</p>
						{trackBounds && (
							<p className="text-gray-300 text-sm">
								GPS Bounds: {trackBounds.minLat.toFixed(4)},{" "}
								{trackBounds.minLon.toFixed(4)} to{" "}
								{trackBounds.maxLat.toFixed(4)}, {trackBounds.maxLon.toFixed(4)}
							</p>
						)}
					</div>
					<div>
						<h3 className="text-lg font-semibold text-green-400">
							Data Quality
						</h3>
						<p className="text-gray-300">
							GPS Points: {dataWithGPSCoordinates.length}
						</p>
						<p className="text-gray-300">
							Processing: Integrated GPS & Telemetry
						</p>
					</div>
					<div>
						<h3 className="text-lg font-semibold text-purple-400">
							Current Selection
						</h3>
						{selectedIndex >= 0 && dataWithGPSCoordinates[selectedIndex] && (
							<>
								<p className="text-gray-300">
									Speed:{" "}
									{dataWithGPSCoordinates[selectedIndex].Speed?.toFixed(1) ||
										"N/A"}{" "}
									km/h
								</p>
								<p className="text-gray-300">
									Position:{" "}
									{dataWithGPSCoordinates[selectedIndex].Lat?.toFixed(6)},{" "}
									{dataWithGPSCoordinates[selectedIndex].Lon?.toFixed(6)}
								</p>
								<p className="text-gray-300">
									Section:{" "}
									{(dataWithGPSCoordinates[selectedIndex] as any).sectionType ||
										"Unknown"}
								</p>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				{/* Track Map */}
				<div className="col-span-1 lg:col-span-2 bg-gray-800 p-4 rounded-lg">
					<h2 className="text-xl font-semibold mb-2 flex items-center gap-2 pb-0">
						GPS Track Map
						{trackInfo?.trackName && (
							<span className="text-sm text-gray-400">
								- {trackInfo.trackName}
							</span>
						)}
					</h2>

					{dataWithGPSCoordinates.length > 0 ? (
						<TrackView
							dataWithCoordinates={dataWithGPSCoordinates}
							selectedPointIndex={selectedIndex}
							selectedLapPct={selectedLapPct}
							isScrubbing={isScrubbing}
							getTrackDisplayPoint={getTrackDisplayPoint}
							onPointClick={handleTrackPointClick}
							selectedMetric={selectedMetric}
						/>
					) : (
						<div className="h-[500px] bg-gray-700 rounded-lg flex items-center justify-center">
							<div className="text-center">
								<p className="text-gray-400 mb-2">No GPS data available</p>
								<p className="text-gray-500 text-sm">
									This session may not contain GPS coordinates or they may be
									invalid.
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Telemetry Chart */}
				<div>
					<TelemetryChart
						selectedMetric={selectedMetric}
						setSelectedMetric={setSelectedMetric}
						availableMetrics={availableMetrics}
						telemetryData={dataWithGPSCoordinates as TelemetryDataPoint[]}
						selectedIndex={selectedIndex}
						onIndexChange={(index) => {
							handlePointSelection(index);
							setIsScrubbing(true);
							setTimeout(() => setIsScrubbing(false), 500);
						}}
					/>
				</div>
			</div>

			{/* Info Boxes */}
			{dataWithGPSCoordinates.length > 0 && (
				<InfoBox
					telemetryData={dataWithGPSCoordinates as TelemetryDataPoint[]}
					lapId={currentLapId.toString()}
				/>
			)}

			{dataWithGPSCoordinates.length > 0 && (
				<GPSAnalysisPanel data={dataWithGPSCoordinates} />
			)}
		</div>
	);
}

function SessionInfo({
	sessionId,
	currentLapId,
	availableLaps,
	onLapChange,
}: {
	sessionId: string;
	currentLapId: number;
	availableLaps: Array<{ lap_id: number }>;
	onLapChange: (lapId: string) => void;
}) {
	return (
		<div className="flex gap-2 text-gray-300 items-center">
			<p>Session: {sessionId}</p>
			<label htmlFor="sessionSelect" className="mr-0">
				Lap:
			</label>
			<select
				name="sessionSelect"
				value={currentLapId}
				onChange={(e) => onLapChange(e.target.value)}
				className="bg-gray-700 text-white p-1 rounded"
			>
				{availableLaps.map((lap) => (
					<option key={lap.lap_id} value={lap.lap_id}>
						Lap {lap.lap_id}
					</option>
				))}
			</select>
		</div>
	);
}

function GPSAnalysisPanel({ data }: { data: any[] }) {
	const totalDistance = data.reduce(
		(sum, point) => sum + (point.distanceFromPrev || 0),
		0,
	);
	const avgSpeed =
		data.reduce((sum, point) => sum + (point.Speed || 0), 0) / data.length;
	const maxSpeed = Math.max(...data.map((point) => point.Speed || 0));
	const minSpeed = Math.min(...data.map((point) => point.Speed || 0));

	const corners = data.filter((point) => point.sectionType === "corner");

	return (
		<div className="mt-4 bg-gray-800 p-4 rounded-lg">
			<h2 className="text-xl font-semibold mb-4">GPS Track Analysis</h2>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div className="bg-gray-700 p-3 rounded">
					<div className="text-sm text-gray-400">Total Distance</div>
					<div className="text-xl font-bold">
						{(totalDistance / 1000).toFixed(2)} km
					</div>
				</div>
				<div className="bg-gray-700 p-3 rounded">
					<div className="text-sm text-gray-400">Average Speed</div>
					<div className="text-xl font-bold">{avgSpeed.toFixed(1)} km/h</div>
				</div>
				<div className="bg-gray-700 p-3 rounded">
					<div className="text-sm text-gray-400">Speed Range</div>
					<div className="text-xl font-bold">
						{minSpeed.toFixed(0)} - {maxSpeed.toFixed(0)} km/h
					</div>
				</div>
				<div className="bg-gray-700 p-3 rounded">
					<div className="text-sm text-gray-400">Corner Points</div>
					<div className="text-xl font-bold">{corners.length}</div>
					<div className="text-xs text-gray-500">
						{((corners.length / data.length) * 100).toFixed(1)}% of lap
					</div>
				</div>
			</div>
		</div>
	);
}
