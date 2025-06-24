"use client";

import { useState } from "react";
import { TelemetryDataPoint } from "@/lib/types";
import EnhancedGPSTrackMap from "./EnhancedTrackMap2D";
import Track3D from "./Track3d";

interface TrackViewSwitcherProps {
    dataWithCoordinates: TelemetryDataPoint[];
    selectedPointIndex: number;
    selectedLapPct: number;
    isScrubbing: boolean;
    getTrackDisplayPoint: () => TelemetryDataPoint | null;
    onPointClick?: (index: number) => void;
    trackName?: string;
}

type ViewMode = '2d' | '3d';

export default function TrackViewSwitcher({
    dataWithCoordinates,
    selectedPointIndex,
    selectedLapPct,
    isScrubbing,
    getTrackDisplayPoint,
    onPointClick,
    trackName,
}: TrackViewSwitcherProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('2d');

    // Calculate some stats for display
    const speedRange = dataWithCoordinates.length > 0 ? {
        min: Math.min(...dataWithCoordinates.map(p => p.Speed)),
        max: Math.max(...dataWithCoordinates.map(p => p.Speed))
    } : { min: 0, max: 0 };

    const hasRealSensorData = dataWithCoordinates.some(p =>
        p.LatAccel !== undefined || p.LongAccel !== undefined || p.Alt !== undefined
    );

    return (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Header with view switcher */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            GPS Track Visualization
                            {trackName && (
                                <span className="text-sm text-gray-400 font-normal">- {trackName}</span>
                            )}
                        </h2>
                        {hasRealSensorData && (
                            <p className="text-xs text-green-400 mt-1">
                                ✓ Real iRacing sensor data detected
                            </p>
                        )}
                    </div>

                    {/* View Mode Switcher */}
                    <div className="flex bg-gray-700 rounded-lg p-1 self-start sm:self-auto">
                        <button
                            onClick={() => setViewMode('2d')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === '2d'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-300 hover:text-white hover:bg-gray-600'
                                }`}
                        >
                            2D Map
                        </button>
                        <button
                            onClick={() => setViewMode('3d')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === '3d'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-300 hover:text-white hover:bg-gray-600'
                                }`}
                        >
                            3D Track
                        </button>
                    </div>
                </div>

                {/* View Description */}
                <div className="mt-3 text-sm text-gray-400">
                    {viewMode === '2d' ? (
                        <p>
                            Interactive map with speed (blue) and lateral G-force (green) data from real iRacing sensors.
                            Click dots to select points.
                        </p>
                    ) : (
                        <p>
                            3D track with real altitude data. Blue/green lines show speed and acceleration intensity.
                            Drag to rotate, scroll to zoom.
                        </p>
                    )}
                </div>
            </div>

            {/* Track Visualization */}
            <div className="relative">
                {dataWithCoordinates.length > 0 ? (
                    <div className="w-full">
                        {viewMode === '2d' ? (
                            <EnhancedGPSTrackMap
                                dataWithCoordinates={dataWithCoordinates}
                                selectedPointIndex={selectedPointIndex}
                                selectedLapPct={selectedLapPct}
                                isScrubbing={isScrubbing}
                                getTrackDisplayPoint={getTrackDisplayPoint}
                                onPointClick={onPointClick}
                            />
                        ) : (
                            <Track3D
                                dataWithCoordinates={dataWithCoordinates}
                                selectedPointIndex={selectedPointIndex}
                                selectedLapPct={selectedLapPct}
                                isScrubbing={isScrubbing}
                                onPointClick={onPointClick}
                            />
                        )}
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

            {/* Data Quality Information */}
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
                            <div className="text-xs text-gray-400 mb-1">View Mode</div>
                            <div className="text-lg font-bold text-blue-400">
                                {viewMode.toUpperCase()}
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
                    </div>

                    {/* Sensor Data Status */}
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
                    </div>
                </div>
            )}
        </div>
    );
}