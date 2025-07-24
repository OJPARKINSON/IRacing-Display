"use client";

import {
    useSearchParams,
    useRouter,
    ReadonlyURLSearchParams,
} from "next/navigation";
import { usePathname } from "next/navigation";
import { use, useState } from "react";
import useSWR from "swr";

import { TelemetryChart, InfoBox } from "@/components/InfoBox";
import { TelemetryRes } from "../../lib/Fetch";
import { useTrackPosition } from "@/hooks/useTrackPosition";
import { TelemetryDataPoint } from "@/lib/types";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import TrackView from "@/components/TrackView";
import { QueryResult } from "pg";

interface Params {
    telemetryData: Promise<[TelemetryRes | undefined, string[] | undefined, Error | undefined]>
    sessionId: string
    searchParams: Promise<{ lapid: string }>
}

export default function TelemetryPage({ telemetryData, sessionId, searchParams }: Params) {
    const router = useRouter();
    const pathname = usePathname();

    const telData = use(telemetryData);
    const { lapid } = use(searchParams);

    if (telData == undefined) {
        return <p>error</p>
    }

    const [telemetryResponse, laps] = telData

    const [selectedMetric, setSelectedMetric] = useState<string>("Speed");
    const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const dataWithGPSCoordinates = telemetryResponse?.dataWithGPSCoordinates || [];
    const trackBounds = telemetryResponse?.trackBounds || null;
    const processError = telemetryResponse?.processError || null;

    const {
        selectedIndex,
        selectedLapPct,
        handlePointSelection,
        getTrackDisplayPoint,
    } = useTrackPosition(dataWithGPSCoordinates as TelemetryDataPoint[]);

    // if (telError && !error) setError(telError);
    if (processError && !error) setError(processError);

    const trackName = dataWithGPSCoordinates?.[0]?.TrackName || "Unknown Track";
    const sessionNum = dataWithGPSCoordinates?.[0]?.SessionNum || sessionId;

    const handleTrackPointClick = (index: number) => {
        handlePointSelection(index);
        setIsScrubbing(true);
        setTimeout(() => setIsScrubbing(false), 500);
    };

    return (
        <div className="p-4 bg-gray-900 text-white min-h-screen">
            <div className="flex justify-between">
                <h1 className="text-2xl font-bold m-4">iRacing Telemetry Dashboard</h1>
                <SessionInfo
                    pathname={pathname}
                    router={router}
                    sessionId={sessionId}
                    lapId={lapid}
                    laps={laps as unknown as { lap_id: string }[]}
                />
            </div>

            <div className="mb-4 bg-gray-800 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-blue-400">
                            Track Information
                        </h3>
                        <p className="text-gray-300">Name: {trackName}</p>
                        <p className="text-gray-300">Session: {sessionNum}</p>
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

            {renderErrorMessage(error)}
            {renderLoadingMessage(telemetryResponse, error)}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="col-span-1 lg:col-span-2 bg-gray-800 p-4 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 pb-0">
                        GPS Track Map
                        {trackName && (
                            <span className="text-sm text-gray-400">- {trackName}</span>
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

            {dataWithGPSCoordinates.length > 0 && lapid && (
                <InfoBox
                    telemetryData={dataWithGPSCoordinates as TelemetryDataPoint[]}
                    lapId={lapid}
                />
            )}

            {dataWithGPSCoordinates.length > 0 && (
                <GPSAnalysisPanel data={dataWithGPSCoordinates} />
            )}
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

function SessionInfo({
    sessionId,
    lapId,
    router,
    pathname,
    laps
}: {
    sessionId: string;
    lapId?: string;
    router: AppRouterInstance;
    pathname: string;
    laps: { lap_id: string }[]
}) {

    console.log(JSON.stringify(lapId))

    if (lapId == null) {
        return <p>Error loading laps</p>;
    }

    return (
        <div className="flex gap-2 m-4 text-gray-300 items-center">
            <p>Session: {sessionId}</p>
            <label className="mr-0">Lap:</label>
            <select
                value={lapId}
                onChange={(e) => {
                    const params = new URLSearchParams();
                    params.set("lapId", e.target.value);
                    router.push(pathname + "?" + params.toString());
                }}
                className="bg-gray-700 text-white p-1 rounded"
            >
                {laps.map((lap) => Number(lap.lap_id)).map((lap, i) => (
                    <option key={lap + i} value={lap}>
                        Lap {lap}
                    </option>
                ))}
            </select>
        </div>
    );
}

function renderErrorMessage(error: string | null) {
    if (!error) return null;

    return (
        <div className="bg-red-900 text-white m-4 p-4 rounded">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
        </div>
    );
}

function renderLoadingMessage(telemetryResponse: any, error: string | null) {
    if (telemetryResponse !== undefined || error !== null) return null;

    return (
        <div className="bg-gray-800 text-white p-4 rounded mb-4 text-center">
            <p className="animate-pulse">Loading telemetry data...</p>
        </div>
    );
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