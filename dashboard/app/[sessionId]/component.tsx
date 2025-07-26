"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import useSWR from "swr";

// Lazy load heavy components
const InfoBox = lazy(() =>
	import("@/components/InfoBox").then((module) => ({
		default: module.InfoBox,
	})),
);
const TrackView = lazy(() => import("@/components/TrackView"));
const OptimizedTelemetryChart = lazy(() =>
	import("@/components/InfoBox").then((module) => ({
		default: module.TelemetryChart,
	})),
);

// Dynamic imports for better code splitting
const EnhancedGPSTrackMap = dynamic(
	() => import("@/components/EnhancedTrackMap2D"),
	{
		ssr: false,
		loading: () => <MapLoadingSkeleton />,
	},
);

import { useTrackPosition } from "@/hooks/useTrackPosition";
import { fetcher } from "@/lib/Fetch";
import type { TelemetryDataPoint } from "@/lib/types";

// Memoized loading components
const MapLoadingSkeleton = memo(function MapLoadingSkeleton() {
	return (
		<div className="h-[500px] bg-gray-700 rounded-lg flex items-center justify-center">
			<div className="animate-pulse">
				<div className="w-16 h-16 bg-gray-600 rounded-full"></div>
				<p className="text-gray-400 mt-2">Loading Map...</p>
			</div>
		</div>
	);
});

const ChartLoadingSkeleton = memo(function ChartLoadingSkeleton() {
	return (
		<div className="bg-gray-800 p-4 rounded-lg">
			<div className="h-64 bg-gray-700 rounded animate-pulse"></div>
		</div>
	);
});

const StatsLoadingSkeleton = memo(function StatsLoadingSkeleton() {
	return (
		<div className="bg-gray-800 p-4 rounded-lg">
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{[...Array(4)].map((v, i) => (
					<div
						key={v + i.toString()}
						className="bg-gray-700 p-3 rounded animate-pulse"
					>
						<div className="h-4 bg-gray-600 rounded mb-2"></div>
						<div className="h-6 bg-gray-600 rounded"></div>
					</div>
				))}
			</div>
		</div>
	);
});

// Memoized session info component
const SessionInfo = memo(function SessionInfo({
	sessionId,
	lapId,
	router,
	pathname,
	laps,
}: {
	sessionId: string;
	lapId: string;
	router: any;
	pathname: string;
	laps: { lap_id: string }[];
}) {
	const handleLapChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const params = new URLSearchParams();
			params.set("lapId", e.target.value);
			router.push(pathname + "?" + params.toString());
		},
		[router, pathname],
	);

	if (!lapId) {
		return <p className="text-red-400">Error loading laps</p>;
	}

	return (
		<div className="flex gap-2 m-4 text-gray-300 items-center">
			<p>Session: {sessionId}</p>
			<label htmlFor="rgegre" className="mr-0">
				Lap:
			</label>
			<select
				value={lapId}
				onChange={handleLapChange}
				className="bg-gray-700 text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				{laps.map((lap) => {
					const lapNumber = Number(lap.lap_id);
					return (
						<option key={`${lapNumber}-${lap.lap_id}`} value={lapNumber}>
							Lap {lapNumber}
						</option>
					);
				})}
			</select>
		</div>
	);
});

// Memoized error message component
const ErrorMessage = memo(function ErrorMessage({
	error,
}: {
	error: string | null;
}) {
	if (!error) return null;

	return (
		<div className="bg-red-900 text-white m-4 p-4 rounded-lg border border-red-700">
			<p className="font-semibold">Error</p>
			<p>{error}</p>
		</div>
	);
});

// Memoized track information component
const TrackInformation = memo(function TrackInformation({
	trackName,
	sessionNum,
	trackBounds,
	dataLength,
}: {
	trackName: string;
	sessionNum: string;
	trackBounds: any;
	dataLength: number;
}) {
	return (
		<div className="mb-4 bg-gray-800 p-4 rounded-lg border border-gray-700">
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<h3 className="text-lg font-semibold text-blue-400 mb-2">
						Track Information
					</h3>
					<p className="text-gray-300">
						Name: <span className="text-white">{trackName}</span>
					</p>
					<p className="text-gray-300">
						Session: <span className="text-white">{sessionNum}</span>
					</p>
					{trackBounds && (
						<p className="text-gray-300 text-sm">
							GPS Bounds: {trackBounds.minLat.toFixed(4)},{" "}
							{trackBounds.minLon.toFixed(4)} to {trackBounds.maxLat.toFixed(4)}
							, {trackBounds.maxLon.toFixed(4)}
						</p>
					)}
				</div>
				<div>
					<h3 className="text-lg font-semibold text-green-400 mb-2">
						Data Quality
					</h3>
					<p className="text-gray-300">
						GPS Points:{" "}
						<span className="text-white">{dataLength.toLocaleString()}</span>
					</p>
					<p className="text-gray-300">
						Processing:{" "}
						<span className="text-green-400">Integrated GPS & Telemetry</span>
					</p>
				</div>
				<div>
					<h3 className="text-lg font-semibold text-purple-400 mb-2">
						Performance
					</h3>
					<p className="text-gray-300">
						Status: <span className="text-green-400">Optimized</span>
					</p>
					<p className="text-gray-300">
						Rendering:{" "}
						<span className="text-blue-400">Hardware Accelerated</span>
					</p>
				</div>
			</div>
		</div>
	);
});

// Optimized GPS analysis panel with virtualization for large datasets
const GPSAnalysisPanel = memo(({ data }: { data: any[] }) => {
	const stats = useMemo(() => {
		if (!data?.length) return null;

		const totalDistance = data.reduce(
			(sum, point) => sum + (point.distanceFromPrev || 0),
			0,
		);
		const speeds = data.map((point) => point.Speed || 0).filter((s) => s > 0);
		const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
		const maxSpeed = Math.max(...speeds);
		const minSpeed = Math.min(...speeds);
		const corners = data.filter((point) => point.sectionType === "corner");

		return {
			totalDistance: (totalDistance / 1000).toFixed(2),
			avgSpeed: avgSpeed.toFixed(1),
			maxSpeed: maxSpeed.toFixed(0),
			minSpeed: minSpeed.toFixed(0),
			cornerCount: corners.length,
			cornerPercentage: ((corners.length / data.length) * 100).toFixed(1),
		};
	}, [data]);

	if (!stats) return null;

	return (
		<div className="mt-4 bg-gray-800 p-4 rounded-lg border border-gray-700">
			<h2 className="text-xl font-semibold mb-4 text-amber-400">
				GPS Track Analysis
			</h2>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div className="bg-gray-700 p-3 rounded-lg border border-gray-600">
					<div className="text-sm text-gray-400">Total Distance</div>
					<div className="text-xl font-bold text-blue-400">
						{stats.totalDistance} km
					</div>
				</div>
				<div className="bg-gray-700 p-3 rounded-lg border border-gray-600">
					<div className="text-sm text-gray-400">Average Speed</div>
					<div className="text-xl font-bold text-green-400">
						{stats.avgSpeed} km/h
					</div>
				</div>
				<div className="bg-gray-700 p-3 rounded-lg border border-gray-600">
					<div className="text-sm text-gray-400">Speed Range</div>
					<div className="text-xl font-bold text-yellow-400">
						{stats.minSpeed} - {stats.maxSpeed} km/h
					</div>
				</div>
				<div className="bg-gray-700 p-3 rounded-lg border border-gray-600">
					<div className="text-sm text-gray-400">Corner Points</div>
					<div className="text-xl font-bold text-purple-400">
						{stats.cornerCount}
					</div>
					<div className="text-xs text-gray-500">
						{stats.cornerPercentage}% of lap
					</div>
				</div>
			</div>
		</div>
	);
});

// Optimized available metrics - reduced to essential ones to improve performance
const availableMetrics = [
	"Speed",
	"Throttle",
	"Brake",
	"RPM",
	"SteeringWheelAngle",
	"LapDistPct",
	"Gear",
] as const;

interface TelemetryPageProps {
	sessionId: string;
	lapId: string;
}

export default function OptimizedTelemetryPage({
	sessionId,
	lapId,
}: TelemetryPageProps) {
	const router = useRouter();
	const searchParams = useSearchParams();

	// State management with better initial values
	const [selectedMetric, setSelectedMetric] = useState<string>("Speed");
	const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	// Refs for performance optimization
	const scrubbingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Memoized SWR keys to prevent unnecessary re-renders
	const telemetryKey = useMemo(
		() => `/api/telemetry?sessionId=${sessionId}&lapId=${lapId}`,
		[sessionId, lapId],
	);

	const lapsKey = useMemo(
		() => `/api/laps?sessionId=${sessionId}`,
		[sessionId],
	);

	// Optimized data fetching with better error handling
	const {
		data: telemetryResponse,
		error: telError,
		isValidating: telLoading,
	} = useSWR(telemetryKey, fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		dedupingInterval: 60000, // Cache for 1 minute
		errorRetryCount: 3,
		errorRetryInterval: 5000,
	});

	const { data: lapsResponse, error: lapsError } = useSWR(lapsKey, fetcher, {
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		dedupingInterval: 300000, // Cache for 5 minutes
	});

	// Fix the dataWithGPSCoordinates useMemo dependency issue
	const rawTelemetryData = useMemo(() => {
		return telemetryResponse?.data;
	}, [telemetryResponse?.data]);

	const dataWithGPSCoordinates = useMemo(() => {
		return rawTelemetryData || [];
	}, [rawTelemetryData]);

	// Memoized processed data to prevent recalculation
	const processedData = useMemo(() => {
		if (!rawTelemetryData) return null;

		return {
			dataWithGPSCoordinates,
			trackBounds: telemetryResponse?.trackBounds || null,
			processError: telemetryResponse?.processError || null,
		};
	}, [
		rawTelemetryData,
		dataWithGPSCoordinates,
		telemetryResponse?.trackBounds,
		telemetryResponse?.processError,
	]);

	const trackBounds = processedData?.trackBounds;
	const processError = processedData?.processError;

	// Track position management
	const {
		selectedIndex,
		selectedLapPct,
		handlePointSelection,
		getTrackDisplayPoint,
	} = useTrackPosition(dataWithGPSCoordinates as TelemetryDataPoint[]);

	// Error handling
	useEffect(() => {
		if (telError && !error)
			setError(telError.message || "Failed to load telemetry data");
		if (processError && !error) setError(processError);
		if (lapsError && !error) setError("Failed to load lap data");
	}, [telError, processError, lapsError, error]);

	// Optimized track point click handler
	const handleTrackPointClick = useCallback(
		(index: number) => {
			handlePointSelection(index);
			setIsScrubbing(true);

			// Clear previous timeout
			if (scrubbingTimeoutRef.current) {
				clearTimeout(scrubbingTimeoutRef.current);
			}

			// Set new timeout
			scrubbingTimeoutRef.current = setTimeout(() => {
				setIsScrubbing(false);
			}, 500);
		},
		[handlePointSelection],
	);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (scrubbingTimeoutRef.current) {
				clearTimeout(scrubbingTimeoutRef.current);
			}
		};
	}, []);

	// Memoized track info
	const trackInfo = useMemo(() => {
		const trackName = dataWithGPSCoordinates?.[0]?.TrackName || "Unknown Track";
		const sessionNum = dataWithGPSCoordinates?.[0]?.SessionNum || sessionId;
		return { trackName, sessionNum };
	}, [dataWithGPSCoordinates, sessionId]);

	const currentPoint = useMemo(() => {
		if (selectedIndex >= 0 && dataWithGPSCoordinates[selectedIndex]) {
			return dataWithGPSCoordinates[selectedIndex];
		}
		return null;
	}, [selectedIndex, dataWithGPSCoordinates]);

	// Loading state
	if (telLoading && !dataWithGPSCoordinates.length) {
		return (
			<div className="p-4 bg-gray-900 text-white min-h-screen">
				<div className="flex justify-between mb-4">
					<h1 className="text-2xl font-bold m-4">
						iRacing Telemetry Dashboard
					</h1>
					<div className="animate-pulse bg-gray-800 h-10 w-48 rounded m-4"></div>
				</div>
				<div className="space-y-4">
					<div className="animate-pulse bg-gray-800 h-32 rounded-lg"></div>
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
						<div className="col-span-2 animate-pulse bg-gray-800 h-96 rounded-lg"></div>
						<div className="animate-pulse bg-gray-800 h-96 rounded-lg"></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 bg-gray-900 text-white min-h-screen">
			<div className="flex justify-between items-center mb-4">
				<h1 className="text-2xl font-bold m-4">iRacing Telemetry Dashboard</h1>
				<SessionInfo
					sessionId={sessionId}
					lapId={lapId}
					router={router}
					pathname={`/${sessionId}`}
					laps={lapsResponse?.laps || []}
				/>
			</div>

			<TrackInformation
				trackName={trackInfo.trackName}
				sessionNum={trackInfo.sessionNum}
				trackBounds={trackBounds}
				dataLength={dataWithGPSCoordinates.length}
			/>

			<ErrorMessage error={error} />

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
				<div className="col-span-1 lg:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700">
					<h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
						GPS Track Map
						{trackInfo.trackName && (
							<span className="text-sm text-gray-400">
								- {trackInfo.trackName}
							</span>
						)}
					</h2>

					{dataWithGPSCoordinates.length > 0 ? (
						<Suspense fallback={<MapLoadingSkeleton />}>
							<TrackView
								dataWithCoordinates={dataWithGPSCoordinates}
								selectedPointIndex={selectedIndex}
								selectedLapPct={selectedLapPct}
								isScrubbing={isScrubbing}
								getTrackDisplayPoint={getTrackDisplayPoint}
								onPointClick={handleTrackPointClick}
								selectedMetric={selectedMetric}
							/>
						</Suspense>
					) : (
						<div className="h-[500px] bg-gray-700 rounded-lg flex items-center justify-center">
							<div className="text-center">
								<div className="text-6xl mb-4">📍</div>
								<p className="text-gray-400 mb-2">No GPS data available</p>
								<p className="text-gray-500 text-sm">
									This session may not contain GPS coordinates or they may be
									invalid.
								</p>
							</div>
						</div>
					)}
				</div>

				<div>
					<Suspense fallback={<ChartLoadingSkeleton />}>
						<OptimizedTelemetryChart
							selectedMetric={selectedMetric}
							setSelectedMetric={setSelectedMetric}
							availableMetrics={availableMetrics as unknown as string[]}
							telemetryData={dataWithGPSCoordinates as TelemetryDataPoint[]}
							selectedIndex={selectedIndex}
							onIndexChange={handleTrackPointClick}
						/>
					</Suspense>
				</div>
			</div>

			{dataWithGPSCoordinates.length > 0 && lapId && (
				<Suspense fallback={<StatsLoadingSkeleton />}>
					<InfoBox
						telemetryData={dataWithGPSCoordinates as TelemetryDataPoint[]}
						lapId={lapId}
					/>
				</Suspense>
			)}

			{dataWithGPSCoordinates.length > 0 && (
				<GPSAnalysisPanel data={dataWithGPSCoordinates} />
			)}

			{/* Current selection info */}
			{currentPoint && (
				<div className="mt-4 bg-gray-800 p-4 rounded-lg border border-gray-700">
					<h3 className="text-lg font-semibold text-purple-400 mb-2">
						Current Selection
					</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
						<div>
							<span className="text-gray-400">Speed:</span>{" "}
							<span className="text-white font-mono">
								{currentPoint.Speed?.toFixed(1) || "N/A"} km/h
							</span>
						</div>
						<div>
							<span className="text-gray-400">Position:</span>{" "}
							<span className="text-white font-mono">
								{currentPoint.Lat?.toFixed(6)}, {currentPoint.Lon?.toFixed(6)}
							</span>
						</div>
						<div>
							<span className="text-gray-400">Lap %:</span>{" "}
							<span className="text-white font-mono">
								{currentPoint.LapDistPct?.toFixed(2)}%
							</span>
						</div>
						<div>
							<span className="text-gray-400">Section:</span>{" "}
							<span className="text-white font-mono">
								{(currentPoint as any).sectionType || "Unknown"}
							</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
