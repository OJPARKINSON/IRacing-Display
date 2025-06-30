"use client";

import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Stroke, Circle, Fill, Text } from "ol/style";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import { LineString, Point } from "ol/geom";
import { TelemetryDataPoint } from "@/lib/types";

interface TrackMapProps {
    dataWithCoordinates: TelemetryDataPoint[];
    selectedPointIndex: number;
    selectedLapPct: number;
    isScrubbing: boolean;
    getTrackDisplayPoint: () => TelemetryDataPoint | null;
    onPointClick?: (index: number) => void;
}

export default function EnhancedGPSTrackMap({
    dataWithCoordinates,
    selectedPointIndex,
    isScrubbing,
    onPointClick,
}: TrackMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<Map | null>(null);
    const racingLineSourceRef = useRef<VectorSource | null>(null);
    const speedDotsSourceRef = useRef<VectorSource | null>(null);
    const accelerationDotsSourceRef = useRef<VectorSource | null>(null);
    const selectedMarkerSourceRef = useRef<VectorSource | null>(null);

    const [showSpeedDots, setShowSpeedDots] = useState(true);
    const [showAccelerationDots, setShowAccelerationDots] = useState(true);
    const [showRacingLine, setShowRacingLine] = useState(true);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        console.log('Initializing enhanced 2D track map...');

        // Create sources
        const racingLineSource = new VectorSource();
        const speedDotsSource = new VectorSource();
        const accelerationDotsSource = new VectorSource();
        const selectedMarkerSource = new VectorSource();

        // Store refs
        racingLineSourceRef.current = racingLineSource;
        speedDotsSourceRef.current = speedDotsSource;
        accelerationDotsSourceRef.current = accelerationDotsSource;
        selectedMarkerSourceRef.current = selectedMarkerSource;

        // Create layers
        const baseLayer = new TileLayer({
            source: new XYZ({
                url: '/osm-tiles/{z}/{x}/{y}.png',
                attributions: '© OpenStreetMap contributors'
            })
        });

        const racingLineLayer = new VectorLayer({
            source: racingLineSource,
            style: new Style({
                stroke: new Stroke({
                    color: "#ffffff",
                    width: 3,
                }),
            }),
        });

        // Speed dots layer (blue)
        const speedDotsLayer = new VectorLayer({
            source: speedDotsSource,
            style: (feature) => {
                const intensity = feature.get('intensity') || 0;
                const alpha = 0.4 + intensity * 0.6;

                // Create blue to red gradient based on speed
                let color;
                if (intensity < 0.3) {
                    // Low speed: Red
                    color = `rgba(255, 0, 0, ${alpha})`;
                } else if (intensity < 0.6) {
                    // Medium speed: Yellow  
                    color = `rgba(255, 255, 0, ${alpha})`;
                } else {
                    // High speed: Green
                    color = `rgba(0, 255, 0, ${alpha})`;
                }

                return new Style({
                    image: new Circle({
                        radius: 3 + intensity * 5,
                        fill: new Fill({
                            color: color,
                        }),
                        stroke: new Stroke({
                            color: "#ffffff",
                            width: 1,
                        }),
                    }),
                });
            },
        });

        // Acceleration dots layer (green)
        const accelerationDotsLayer = new VectorLayer({
            source: accelerationDotsSource,
            style: (feature) => {
                const intensity = feature.get('intensity') || 0;
                const alpha = 0.3 + intensity * 0.7;
                return new Style({
                    image: new Circle({
                        radius: 4 + intensity * 4,
                        fill: new Fill({
                            color: `rgba(0, 255, 136, ${alpha})`, // Green with variable alpha
                        }),
                        stroke: new Stroke({
                            color: "#ffffff",
                            width: 1,
                        }),
                    }),
                });
            },
        });

        const selectedMarkerLayer = new VectorLayer({
            source: selectedMarkerSource,
            style: new Style({
                image: new Circle({
                    radius: 12,
                    fill: new Fill({
                        color: "#ffff00",
                    }),
                    stroke: new Stroke({
                        color: "#000000",
                        width: 3,
                    }),
                }),
            }),
        });

        // Create map
        const map = new Map({
            target: mapRef.current,
            layers: [
                baseLayer,
                racingLineLayer,
                speedDotsLayer,
                accelerationDotsLayer,
                selectedMarkerLayer,
            ],
            view: new View({
                center: fromLonLat([9.2808, 45.6162]), // Monza coordinates
                zoom: 15,
                maxZoom: 20,
                minZoom: 5,
            }),
        });

        // Add click handler for dots
        map.on('click', (event) => {
            const features = map.getFeaturesAtPixel(event.pixel);
            if (features.length > 0) {
                const feature = features[0];
                const originalIndex = feature.get('originalIndex');
                if (originalIndex !== undefined && onPointClick) {
                    onPointClick(originalIndex);
                }
            }
        });

        mapInstanceRef.current = map;

        console.log('Enhanced 2D track map initialized');

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.setTarget(undefined);
                mapInstanceRef.current = null;
            }
            racingLineSourceRef.current = null;
            speedDotsSourceRef.current = null;
            accelerationDotsSourceRef.current = null;
            selectedMarkerSourceRef.current = null;
        };
    }, [onPointClick]);

    // Update track data
    useEffect(() => {
        if (!mapInstanceRef.current || !dataWithCoordinates.length) {
            return;
        }

        if (!racingLineSourceRef.current || !speedDotsSourceRef.current || !accelerationDotsSourceRef.current) {
            return;
        }

        console.log('Updating enhanced track with', dataWithCoordinates.length, 'points');

        // Clear previous data
        racingLineSourceRef.current.clear();
        speedDotsSourceRef.current.clear();
        accelerationDotsSourceRef.current.clear();

        try {
            // Filter valid GPS points
            const validGPSPoints = dataWithCoordinates.filter(
                (point) => point.Lat && point.Lon && point.Lat !== 0 && point.Lon !== 0,
            );

            if (validGPSPoints.length === 0) {
                console.warn("No valid GPS coordinates found");
                return;
            }

            // Create racing line
            if (showRacingLine) {
                const lineCoordinates = validGPSPoints.map((point) =>
                    fromLonLat([point.Lon, point.Lat]),
                );

                const lineFeature = new Feature({
                    geometry: new LineString(lineCoordinates),
                });

                racingLineSourceRef.current.addFeature(lineFeature);
            }

            // Create speed dots (blue) - sample every few points to avoid overcrowding
            if (showSpeedDots) {
                const speedSampleRate = Math.max(1, Math.floor(validGPSPoints.length / 100));
                for (let i = 0; i < validGPSPoints.length; i += speedSampleRate) {
                    const point = validGPSPoints[i];
                    if (!point.normalizedSpeed) continue;

                    const dotFeature = new Feature({
                        geometry: new Point(fromLonLat([point.Lon, point.Lat])),
                    });

                    dotFeature.setProperties({
                        intensity: point.normalizedSpeed,
                        originalIndex: point.originalIndex || i,
                        type: 'speed',
                        value: point.Speed,
                    });

                    speedDotsSourceRef.current.addFeature(dotFeature);
                }
            }

            // Create acceleration dots (green) - focus on high lateral G areas
            if (showAccelerationDots) {
                // Use real iRacing lateral acceleration data
                const gThreshold = 2.0; // Show points above 2 m/s² lateral acceleration
                const highGPoints = validGPSPoints.filter(
                    point => Math.abs(point.lateralAccel || 0) > gThreshold
                );

                for (const point of highGPoints) {
                    const dotFeature = new Feature({
                        geometry: new Point(fromLonLat([point.Lon, point.Lat])),
                    });

                    // Normalize lateral G for visualization (0-1 range)
                    const lateralG = Math.abs(point.lateralAccel || 0);
                    const normalizedG = Math.min(lateralG / 10.0, 1.0); // Scale to reasonable max

                    dotFeature.setProperties({
                        intensity: normalizedG,
                        originalIndex: point.originalIndex || 0,
                        type: 'acceleration',
                        value: lateralG,
                        gForce: (lateralG / 9.81).toFixed(2) + 'g', // Convert to G-force
                    });

                    accelerationDotsSourceRef.current.addFeature(dotFeature);
                }
            }

            // Fit view to track
            if (!isScrubbing && showRacingLine) {
                const lineCoordinates = validGPSPoints.map((point) =>
                    fromLonLat([point.Lon, point.Lat]),
                );
                const lineFeature = new Feature({
                    geometry: new LineString(lineCoordinates),
                });

                const geometry = lineFeature.getGeometry();
                if (geometry) {
                    mapInstanceRef.current.getView().fit(geometry.getExtent(), {
                        padding: [50, 50, 50, 50],
                        duration: 1000,
                        maxZoom: 18,
                    });
                }
            }

            console.log('Enhanced track updated successfully');
        } catch (error) {
            console.error("Error updating enhanced track:", error);
        }
    }, [dataWithCoordinates, isScrubbing, showSpeedDots, showAccelerationDots, showRacingLine]);

    // Update selected marker
    useEffect(() => {
        if (!selectedMarkerSourceRef.current || !dataWithCoordinates.length) {
            return;
        }

        selectedMarkerSourceRef.current.clear();

        const validIndex = Math.min(
            Math.max(0, selectedPointIndex),
            dataWithCoordinates.length - 1,
        );

        const selectedPoint = dataWithCoordinates[validIndex];

        if (selectedPoint && selectedPoint.Lat && selectedPoint.Lon) {
            const markerCoords = fromLonLat([selectedPoint.Lon, selectedPoint.Lat]);

            const markerFeature = new Feature({
                geometry: new Point(markerCoords),
            });

            const displayText = `${selectedPoint.LapDistPct.toFixed(1)}% - ${selectedPoint.Speed.toFixed(1)}kph`;

            markerFeature.setStyle(
                new Style({
                    image: new Circle({
                        radius: 12,
                        fill: new Fill({
                            color: "#ffff00",
                        }),
                        stroke: new Stroke({
                            color: "#000000",
                            width: 3,
                        }),
                    }),
                    text: new Text({
                        text: displayText,
                        offsetY: -25,
                        font: "14px sans-serif",
                        fill: new Fill({
                            color: "#ffffff",
                        }),
                        stroke: new Stroke({
                            color: "#000000",
                            width: 3,
                        }),
                    }),
                }),
            );

            selectedMarkerSourceRef.current.addFeature(markerFeature);

            // Center map on selected point when scrubbing
            if (isScrubbing && mapInstanceRef.current) {
                mapInstanceRef.current.getView().animate({
                    center: markerCoords,
                    duration: 300,
                });
            }
        }
    }, [selectedPointIndex, dataWithCoordinates, isScrubbing]);

    const handleZoomIn = (): void => {
        if (mapInstanceRef.current) {
            const view = mapInstanceRef.current.getView();
            view.animate({
                zoom: view.getZoom()! + 0.5,
                duration: 250,
            });
        }
    };

    const handleZoomOut = (): void => {
        if (mapInstanceRef.current) {
            const view = mapInstanceRef.current.getView();
            view.animate({
                zoom: view.getZoom()! - 0.5,
                duration: 250,
            });
        }
    };

    return (
        <div className="h-[500px] bg-gray-800 rounded-lg relative">
            {/* Zoom Controls */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                <button
                    onClick={handleZoomIn}
                    className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 flex items-center justify-center rounded shadow"
                    aria-label="Zoom in"
                >
                    +
                </button>
                <button
                    onClick={handleZoomOut}
                    className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 flex items-center justify-center rounded shadow"
                    aria-label="Zoom out"
                >
                    -
                </button>
            </div>

            {/* Layer Controls */}
            <div className="absolute top-2 right-2 z-10 bg-gray-700 bg-opacity-90 p-3 rounded text-white text-xs">
                <div className="mb-2 font-semibold">Layer Controls</div>

                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showRacingLine}
                        onChange={(e) => setShowRacingLine(e.target.checked)}
                        className="rounded"
                    />
                    <div className="w-4 h-1 bg-white"></div>
                    <span>Racing Line</span>
                </label>

                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showSpeedDots}
                        onChange={(e) => setShowSpeedDots(e.target.checked)}
                        className="rounded"
                    />
                    <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                    <span>Speed Data</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showAccelerationDots}
                        onChange={(e) => setShowAccelerationDots(e.target.checked)}
                        className="rounded"
                    />
                    <div className="w-4 h-4 bg-green-400 rounded-full"></div>
                    <span>Lateral G-Force ({">"}2 m/s²)</span>
                </label>
            </div>

            {/* Legend */}
            <div className="absolute bottom-2 right-2 z-10 bg-gray-700 bg-opacity-90 p-2 rounded text-white text-xs">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                    <span>Higher Speed</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 bg-green-400 rounded-full"></div>
                    <span>High Lateral G ({">"}2 m/s²)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                    <span>Selected Point</span>
                </div>
                <div className="text-gray-300 mt-1 text-xs">
                    Click dots to select • Real iRacing sensors
                </div>
            </div>

            {/* Debug info */}
            <div className="absolute bottom-2 left-2 z-10 bg-gray-700 bg-opacity-90 p-2 rounded text-white text-xs">
                <div>GPS Points: {dataWithCoordinates.length}</div>
                <div>Speed Dots: {showSpeedDots ? 'ON' : 'OFF'}</div>
                <div>Accel Dots: {showAccelerationDots ? 'ON' : 'OFF'}</div>
            </div>

            {/* Map container */}
            <div
                ref={mapRef}
                className="w-full h-full"
                style={{
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    );
}