"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
    selectedMetric?: string;
}

const MAP_THEMES = {
    dark: {
        name: "Dark",
        url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    },
    osm: {
        name: "OpenStreetMap",
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    }
};

export default function EnhancedGPSTrackMap({
    dataWithCoordinates,
    selectedPointIndex,
    isScrubbing,
    onPointClick,
    selectedMetric = "Speed",
}: TrackMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<Map | null>(null);
    const racingLineSourceRef = useRef<VectorSource | null>(null);
    const selectedMarkerSourceRef = useRef<VectorSource | null>(null);
    const baseLayerRef = useRef<TileLayer<XYZ> | null>(null);

    const [mapTheme, setMapTheme] = useState<keyof typeof MAP_THEMES>('dark');
    const [showThemeSelector, setShowThemeSelector] = useState(false);

    const mapFittedRef = useRef(false);

    const lastDataHashRef = useRef<string>("");

    const processedTrackData = useMemo(() => {
        if (!dataWithCoordinates?.length) return null;

        const validGPSPoints = dataWithCoordinates.filter(
            (point) => point.Lat && point.Lon && point.Lat !== 0 && point.Lon !== 0,
        );

        if (validGPSPoints.length === 0) return null;

        const dataHash = JSON.stringify(validGPSPoints.map(p => ({
            lat: p.Lat,
            lon: p.Lon,
            speed: p.Speed,
            throttle: p.Throttle,
            brake: p.Brake,
            lapDistPct: p.LapDistPct
        })));

        return {
            validGPSPoints,
            lineCoordinates: validGPSPoints.map((point) => fromLonLat([point.Lon, point.Lat])),
            dataHash,
        };
    }, [dataWithCoordinates]);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        console.log('Initializing enhanced 2D track map with dark theme...');

        const racingLineSource = new VectorSource();
        const selectedMarkerSource = new VectorSource();

        racingLineSourceRef.current = racingLineSource;
        selectedMarkerSourceRef.current = selectedMarkerSource;

        const baseLayer = new TileLayer({
            source: new XYZ({
                url: MAP_THEMES[mapTheme].url,

            })
        });
        baseLayerRef.current = baseLayer;

        const racingLineLayer = new VectorLayer({
            source: racingLineSource,
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

        const map = new Map({
            target: mapRef.current,
            layers: [
                baseLayer,
                racingLineLayer,
                selectedMarkerLayer,
            ],
            view: new View({
                center: fromLonLat([9.2808, 45.6162]),
                zoom: 15,
                maxZoom: 20,
                minZoom: 5,
            }),
        });

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
        console.log('Enhanced 2D track map initialized with', mapTheme, 'theme');

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.setTarget(undefined);
                mapInstanceRef.current = null;
            }
            racingLineSourceRef.current = null;
            selectedMarkerSourceRef.current = null;
            baseLayerRef.current = null;
            mapFittedRef.current = false;
            lastDataHashRef.current = "";
        };
    }, [onPointClick, mapTheme]);

    useEffect(() => {
        if (!mapInstanceRef.current || !baseLayerRef.current) return;

        const newSource = new XYZ({
            url: MAP_THEMES[mapTheme].url,
        });

        baseLayerRef.current.setSource(newSource);
        console.log('Map theme updated to:', mapTheme);
    }, [mapTheme]);

    const getColorForValue = useCallback((value: number, metric: string, minVal: number, maxVal: number): string => {
        if (!value || minVal === maxVal) return "#888888";

        const normalized = (value - minVal) / (maxVal - minVal);

        switch (metric) {
            case "Speed":
                if (normalized < 0.3) {
                    return `rgb(255, ${Math.round(100 * normalized)}, 0)`;
                } else if (normalized < 0.7) {
                    const t = (normalized - 0.3) / 0.4;
                    return `rgb(255, ${Math.round(155 + 100 * t)}, 0)`;
                } else {
                    const t = (normalized - 0.7) / 0.3;
                    return `rgb(${Math.round(255 * (1 - t))}, 255, 0)`;
                }
            case "Throttle":
                return `rgb(0, ${Math.round(150 + 105 * normalized)}, 0)`;
            case "Brake":
                return `rgb(${Math.round(150 + 105 * normalized)}, 0, 0)`;
            case "RPM":
                return `rgb(${Math.round(255 * normalized)}, ${Math.round(100 + 155 * (1 - normalized))}, 255)`;
            case "SteeringWheelAngle":
                const absNormalized = Math.abs(normalized - 0.5) * 2;
                return `rgb(${Math.round(150 + 105 * absNormalized)}, 0, ${Math.round(150 + 105 * absNormalized)})`;
            default:
                return `rgb(${Math.round(100 + 155 * normalized)}, ${Math.round(100 + 155 * (1 - normalized))}, 255)`;
        }
    }, []);

    useEffect(() => {
        if (!mapInstanceRef.current || !processedTrackData || !racingLineSourceRef.current) return;

        const { validGPSPoints, lineCoordinates, dataHash } = processedTrackData;

        if (dataHash === lastDataHashRef.current) {
            return;
        }

        console.log('Updating racing line with', validGPSPoints.length, 'points');

        racingLineSourceRef.current.clear();

        try {
            const metricValues = validGPSPoints.map((point: any) => {
                const value = point[selectedMetric];
                return typeof value === 'number' ? value : 0;
            });

            const minVal = Math.min(...metricValues);
            const maxVal = Math.max(...metricValues);

            for (let i = 0; i < validGPSPoints.length - 1; i++) {
                const point = validGPSPoints[i];
                const nextPoint = validGPSPoints[i + 1];

                const segmentCoords = [
                    fromLonLat([point.Lon, point.Lat]),
                    fromLonLat([nextPoint.Lon, nextPoint.Lat]),
                ];

                const segmentFeature = new Feature({
                    geometry: new LineString(segmentCoords),
                });

                const metricValue = (point as any)[selectedMetric] || 0;
                const color = getColorForValue(metricValue, selectedMetric, minVal, maxVal);

                segmentFeature.setStyle(
                    new Style({
                        stroke: new Stroke({
                            color: color,
                            width: 5,
                        }),
                    }),
                );

                segmentFeature.set('originalIndex', point.originalIndex || i);
                segmentFeature.set('metricValue', metricValue);

                racingLineSourceRef.current.addFeature(segmentFeature);
            }

            if (!mapFittedRef.current && !isScrubbing && lineCoordinates.length > 0) {
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
                    mapFittedRef.current = true;
                }
            }

            lastDataHashRef.current = dataHash;
            console.log('Racing line updated successfully with', selectedMetric, 'coloring');
        } catch (error) {
            console.error("Error updating racing line:", error);
        }
    }, [processedTrackData, selectedMetric, getColorForValue, isScrubbing]);

    useEffect(() => {
        if (!selectedMarkerSourceRef.current || !dataWithCoordinates.length) return;

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

            const metricValue = (selectedPoint as any)[selectedMetric] || 0;
            const displayText = `${selectedPoint.LapDistPct.toFixed(1)}% - ${selectedMetric}: ${metricValue.toFixed(1)}`;

            markerFeature.setStyle(
                new Style({
                    image: new Circle({
                        radius: 14,
                        fill: new Fill({
                            color: "#ffff00",
                        }),
                        stroke: new Stroke({
                            color: "#ffffff",
                            width: 2,
                        }),
                    }),
                    text: new Text({
                        text: displayText,
                        offsetY: -25,
                        font: "bold 14px sans-serif",
                        fill: new Fill({
                            color: "#ffffff",
                        }),
                        stroke: new Stroke({
                            color: "#000000",
                            width: 3,
                        }),
                        backgroundFill: new Fill({
                            color: "rgba(0, 0, 0, 0.7)",
                        }),
                        padding: [2, 4, 2, 4],
                    }),
                }),
            );

            selectedMarkerSourceRef.current.addFeature(markerFeature);

            if (isScrubbing && mapInstanceRef.current) {
                mapInstanceRef.current.getView().animate({
                    center: markerCoords,
                    duration: 300,
                });
            }
        }
    }, [selectedPointIndex, dataWithCoordinates, isScrubbing, selectedMetric]);

    const handleZoomIn = useCallback((): void => {
        if (mapInstanceRef.current) {
            const view = mapInstanceRef.current.getView();
            view.animate({
                zoom: view.getZoom()! + 0.5,
                duration: 250,
            });
        }
    }, []);

    const handleZoomOut = useCallback((): void => {
        if (mapInstanceRef.current) {
            const view = mapInstanceRef.current.getView();
            view.animate({
                zoom: view.getZoom()! - 0.5,
                duration: 250,
            });
        }
    }, []);

    const getLegendInfo = useCallback(() => {
        switch (selectedMetric) {
            case "Speed":
                return {
                    title: "Speed (km/h)",
                    colors: [
                        { color: "#FF6400", label: "Low Speed" },
                        { color: "#FFFF00", label: "Medium Speed" },
                        { color: "#00FF00", label: "High Speed" },
                    ]
                };
            case "Throttle":
                return {
                    title: "Throttle (%)",
                    colors: [
                        { color: "#009600", label: "0% Throttle" },
                        { color: "#00FF00", label: "100% Throttle" },
                    ]
                };
            case "Brake":
                return {
                    title: "Brake (%)",
                    colors: [
                        { color: "#960000", label: "0% Brake" },
                        { color: "#FF0000", label: "100% Brake" },
                    ]
                };
            case "RPM":
                return {
                    title: "Engine RPM",
                    colors: [
                        { color: "#64C8FF", label: "Low RPM" },
                        { color: "#FF64FF", label: "High RPM" },
                    ]
                };
            case "SteeringWheelAngle":
                return {
                    title: "Steering Angle",
                    colors: [
                        { color: "#888888", label: "Straight" },
                        { color: "#FF96FF", label: "Full Lock" },
                    ]
                };
            default:
                return {
                    title: selectedMetric,
                    colors: [
                        { color: "#6496FF", label: "Low Value" },
                        { color: "#FF6496", label: "High Value" },
                    ]
                };
        }
    }, [selectedMetric]);

    const legendInfo = getLegendInfo();

    return (
        <div className="h-[500px] bg-gray-900 rounded-lg relative">
            {/* Zoom Controls */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                <button
                    onClick={handleZoomIn}
                    className="bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 flex items-center justify-center rounded shadow border border-gray-600"
                    aria-label="Zoom in"
                >
                    +
                </button>
                <button
                    onClick={handleZoomOut}
                    className="bg-gray-800 hover:bg-gray-700 text-white w-8 h-8 flex items-center justify-center rounded shadow border border-gray-600"
                    aria-label="Zoom out"
                >
                    -
                </button>
            </div>

            {/* Theme Selector */}
            <div className="absolute top-2 left-12 z-10">
                <button
                    onClick={() => setShowThemeSelector(!showThemeSelector)}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded shadow border border-gray-600 text-xs"
                >
                    🎨 {MAP_THEMES[mapTheme].name}
                </button>

                {showThemeSelector && (
                    <div className="absolute top-8 left-0 bg-gray-800 border border-gray-600 rounded shadow-lg p-2 min-w-48">
                        {Object.entries(MAP_THEMES).map(([key, theme]) => (
                            <button
                                key={key}
                                onClick={() => {
                                    setMapTheme(key as keyof typeof MAP_THEMES);
                                    setShowThemeSelector(false);
                                }}
                                className={`block w-full text-left px-2 py-1 text-xs rounded mb-1 ${mapTheme === key
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-700'
                                    }`}
                            >
                                <div className="font-medium">{theme.name}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="absolute top-2 right-2 z-10 bg-gray-800 bg-opacity-95 border border-gray-600 p-3 rounded text-white text-xs">
                <div className="mb-2 font-semibold">{legendInfo.title}</div>
                {legendInfo.colors.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div
                            className="w-4 h-2 border border-gray-500"
                            style={{ backgroundColor: item.color }}
                        ></div>
                        <span>{item.label}</span>
                    </div>
                ))}
                <div className="text-gray-300 mt-2 text-xs border-t border-gray-600 pt-2">
                    Click line to select point<br />
                    Enhanced for dark theme
                </div>
            </div>

            <div className="absolute bottom-2 left-2 z-10 bg-gray-800 bg-opacity-95 border border-gray-600 p-2 rounded text-white text-xs">
                <div>GPS Points: {dataWithCoordinates.length}</div>
                <div>Metric: {selectedMetric}</div>
                <div>Theme: {MAP_THEMES[mapTheme].name}</div>
                <div>Selected: {selectedPointIndex >= 0 ? selectedPointIndex : 'None'}</div>
            </div>

            <div
                ref={mapRef}
                className="w-full h-full rounded-lg overflow-hidden"
                style={{
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    );
}