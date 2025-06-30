"use client";

import { TelemetryDataPoint } from "@/lib/types";
import EnhancedGPSTrackMap from "./EnhancedTrackMap2D";

interface TrackViewProps {
    dataWithCoordinates: TelemetryDataPoint[];
    selectedPointIndex: number;
    selectedLapPct: number;
    isScrubbing: boolean;
    getTrackDisplayPoint: () => TelemetryDataPoint | null;
    onPointClick?: (index: number) => void;
    selectedMetric?: string;
}

export default function TrackView({
    dataWithCoordinates,
    selectedPointIndex,
    selectedLapPct,
    isScrubbing,
    getTrackDisplayPoint,
    onPointClick,
    selectedMetric = "Speed",
}: TrackViewProps) {

    const speedRange = dataWithCoordinates.length > 0 ? {
        min: Math.min(...dataWithCoordinates.map(p => p.Speed)),
        max: Math.max(...dataWithCoordinates.map(p => p.Speed))
    } : { min: 0, max: 0 };

    const hasRealSensorData = dataWithCoordinates.some(p =>
        p.LatAccel !== undefined || p.LongAccel !== undefined || p.Alt !== undefined
    );

    return (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="relative">
                {dataWithCoordinates.length > 0 ? (
                    <div className="w-full">
                        <EnhancedGPSTrackMap
                            dataWithCoordinates={dataWithCoordinates}
                            selectedPointIndex={selectedPointIndex}
                            selectedLapPct={selectedLapPct}
                            isScrubbing={isScrubbing}
                            getTrackDisplayPoint={getTrackDisplayPoint}
                            onPointClick={onPointClick}
                            selectedMetric={selectedMetric}
                        />
                    </div>
                ) : (
                    <div className="h-[600px] bg-gray-700 flex items-center justify-center">
                        <div className="text-center p-8">
                            <div className="text-6xl mb-4">📍</div>
                            <p className="text-gray-300 text-lg mb-2">No GPS data available</p>
                            <p className="text-gray-500 text-sm max-w-md">
                                This session may not contain GPS coordinates or they may be invalid.
                                Make sure your telemetry data includes Lat/Lon fields.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {dataWithCoordinates.length > 0 && (
                <div className="p-4 border-t border-gray-700 bg-gray-850">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-gray-700 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-400 mb-1">GPS Points</div>
                            <div className="text-lg font-bold text-white">
                                {dataWithCoordinates.length.toLocaleString()}
                            </div>
                        </div>

                        <div className="bg-gray-700 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-400 mb-1">Speed Range</div>
                            <div className="text-sm font-bold text-white">
                                {speedRange.min.toFixed(0)} - {speedRange.max.toFixed(0)}
                            </div>
                            <div className="text-xs text-gray-500">km/h</div>
                        </div>

                        <div className="bg-gray-700 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-400 mb-1">Selected</div>
                            <div className="text-lg font-bold text-yellow-400">
                                {selectedPointIndex >= 0 && selectedPointIndex < dataWithCoordinates.length
                                    ? `${dataWithCoordinates[selectedPointIndex].LapDistPct.toFixed(1)}%`
                                    : 'None'
                                }
                            </div>
                        </div>

                        <div className="bg-gray-700 p-3 rounded-lg text-center">
                            <div className="text-xs text-gray-400 mb-1">Current Metric</div>
                            <div className="text-sm font-bold text-cyan-400">
                                {selectedMetric}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {hasRealSensorData ? (
                            <>
                                <span className="bg-green-900 text-green-300 px-2 py-1 rounded">
                                    ✓ Real Acceleration Data
                                </span>
                                {dataWithCoordinates.some(p => p.Alt) && (
                                    <span className="bg-blue-900 text-blue-300 px-2 py-1 rounded">
                                        ✓ Real Altitude Data
                                    </span>
                                )}
                                <span className="bg-purple-900 text-purple-300 px-2 py-1 rounded">
                                    ✓ GPS Coordinates
                                </span>
                            </>
                        ) : (
                            <span className="bg-yellow-900 text-yellow-300 px-2 py-1 rounded">
                                ⚠ Using Calculated Data
                            </span>
                        )}
                        <span className="bg-cyan-900 text-cyan-300 px-2 py-1 rounded">
                            🎨 Colored by {selectedMetric}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}