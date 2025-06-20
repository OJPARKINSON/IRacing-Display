"use client";

import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Stroke, Circle, Fill, Text } from "ol/style";
import { DragPan, MouseWheelZoom } from "ol/interaction";
import { defaults as defaultControls } from "ol/control";
import { fromLonLat, transform } from "ol/proj";
import Feature from "ol/Feature";
import { LineString, Point, Polygon } from "ol/geom";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { getCenter } from "ol/extent";
import "ol/ol.css";
import { useMapLayers } from "@/hooks/useMapLayers";
import { TelemetryDataPoint } from "@/lib/types";

interface TrackMapProps {
	dataWithCoordinates: TelemetryDataPoint[];
	selectedPointIndex: number;
	selectedLapPct: number;
	isScrubbing: boolean;
	getTrackDisplayPoint: () => TelemetryDataPoint | null;
}

export default function GPSTrackMap({
	dataWithCoordinates,
	selectedPointIndex,
	isScrubbing,
}: TrackMapProps) {
	const mapContainerRef = useRef<HTMLDivElement | null>(null);
	const [mapInitialized, setMapInitialized] = useState<boolean>(false);
	const [trackBounds, setTrackBounds] = useState<any>(null);
	const olMapRef = useRef<Map | null>(null);

	// Custom hook for map layers and sources
	const {
		racingLineSourceRef,
		carPositionSourceRef,
		selectedMarkerSourceRef,
		hoverMarkerSourceRef,
	} = useMapLayers();

	// Initialize OpenLayers map with GPS coordinates
	useEffect(() => {
		if (mapInitialized || !mapContainerRef.current) return;

		const initializeMap = (): void => {
			// Create sources
			const racingLineSource = new VectorSource();
			racingLineSourceRef.current = racingLineSource;

			const carPositionSource = new VectorSource();
			carPositionSourceRef.current = carPositionSource;

			const hoverMarkerSource = new VectorSource();
			hoverMarkerSourceRef.current = hoverMarkerSource;

			const selectedMarkerSource = new VectorSource();
			selectedMarkerSourceRef.current = selectedMarkerSource;

			// Track boundaries source (for OpenStreetMap data)
			const trackBoundariesSource = new VectorSource();

			// Create layers
			const osmLayer = new TileLayer({
				source: new OSM(),
			});

			const trackBoundariesLayer = new VectorLayer({
				source: trackBoundariesSource,
				style: new Style({
					fill: new Fill({
						color: "rgba(128, 128, 128, 0.2)",
					}),
					stroke: new Stroke({
						color: "#808080",
						width: 2,
					}),
				}),
				zIndex: 1,
			});

			const racingLineLayer = new VectorLayer({
				source: racingLineSource,
				style: new Style({
					stroke: new Stroke({
						color: "#ff0000",
						width: 4,
					}),
				}),
				zIndex: 10,
			});

			const carPositionLayer = new VectorLayer({
				source: carPositionSource,
				style: new Style({
					image: new Circle({
						radius: 8,
						fill: new Fill({
							color: "#00ff00",
						}),
						stroke: new Stroke({
							color: "#000000",
							width: 2,
						}),
					}),
				}),
				zIndex: 15,
			});

			const selectedMarkerLayer = new VectorLayer({
				source: selectedMarkerSource,
				style: new Style({
					image: new Circle({
						radius: 10,
						fill: new Fill({
							color: "#00ffff",
						}),
						stroke: new Stroke({
							color: "#000000",
							width: 2,
						}),
					}),
				}),
				zIndex: 20,
			});

			// Create the map
			const map = new Map({
				target: mapContainerRef.current!,
				layers: [
					osmLayer,
					trackBoundariesLayer,
					racingLineLayer,
					carPositionLayer,
					selectedMarkerLayer,
				],
				controls: defaultControls({ zoom: true, rotate: false }),
				view: new View({
					center: fromLonLat([9.2808, 45.6162]), // Monza coordinates
					zoom: 15,
					maxZoom: 20,
					minZoom: 10,
				}),
			});

			// Add interactions
			map.addInteraction(new DragPan());
			map.addInteraction(new MouseWheelZoom());

			olMapRef.current = map;

			// Load track boundaries from OpenStreetMap
			loadTrackBoundaries(trackBoundariesSource);

			setMapInitialized(true);
		};

		initializeMap();

		// Cleanup function
		return () => {
			if (olMapRef.current) {
				olMapRef.current.setTarget(undefined);
				olMapRef.current = null;
				racingLineSourceRef.current = null;
				carPositionSourceRef.current = null;
				selectedMarkerSourceRef.current = null;
				hoverMarkerSourceRef.current = null;
			}
		};
	}, [
		racingLineSourceRef,
		carPositionSourceRef,
		selectedMarkerSourceRef,
		hoverMarkerSourceRef,
	]);

	// Load track boundaries from OpenStreetMap using Overpass API
	const loadTrackBoundaries = async (trackBoundariesSource: VectorSource) => {
		try {
			// Overpass API query for Monza race track
			const overpassQuery = `
        [out:json][timeout:25];
        (
          way["sport"="motor"]["name"~"Monza",i];
          way["motorsport"="yes"]["name"~"Monza",i];
          way["highway"="raceway"]["name"~"Monza",i];
          relation["sport"="motor"]["name"~"Monza",i];
        );
        out geom;
      `;

			const response = await fetch("https://overpass-api.de/api/interpreter", {
				method: "POST",
				body: overpassQuery,
			});

			if (response.ok) {
				const data = await response.json();

				// Process the track data
				data.elements.forEach((element: any) => {
					if (element.type === "way" && element.geometry) {
						const coordinates = element.geometry.map((node: any) =>
							fromLonLat([node.lon, node.lat]),
						);

						if (coordinates.length > 2) {
							const trackFeature = new Feature({
								geometry: new Polygon([coordinates]),
							});
							trackBoundariesSource.addFeature(trackFeature);
						}
					}
				});

				console.log("Track boundaries loaded from OpenStreetMap");
			}
		} catch (error) {
			console.warn(
				"Could not load track boundaries from OpenStreetMap:",
				error,
			);
			// Fallback: create approximate track boundaries based on telemetry data
			createFallbackTrackBoundaries(trackBoundariesSource);
		}
	};

	// Create approximate track boundaries based on telemetry data
	const createFallbackTrackBoundaries = (
		trackBoundariesSource: VectorSource,
	) => {
		if (dataWithCoordinates.length === 0) return;

		try {
			// Convert GPS coordinates to map projection
			const trackPoints = dataWithCoordinates
				.filter((point) => point.Lat && point.Lon)
				.map((point) => fromLonLat([point.Lon, point.Lat]));

			if (trackPoints.length > 3) {
				// Create a buffer around the racing line to approximate track boundaries
				const bufferDistance = 50; // meters

				// Simple approach: create inner and outer boundaries
				const outerBoundary = trackPoints.map(([x, y]) => [
					x + bufferDistance,
					y + bufferDistance,
				]);
				const innerBoundary = trackPoints.map(([x, y]) => [
					x - bufferDistance,
					y - bufferDistance,
				]);

				const trackBoundary = new Feature({
					geometry: new Polygon([outerBoundary]),
				});

				trackBoundariesSource.addFeature(trackBoundary);
			}
		} catch (error) {
			console.error("Error creating fallback track boundaries:", error);
		}
	};

	// Update racing line with GPS coordinates
	useEffect(() => {
		if (
			!mapInitialized ||
			!olMapRef.current ||
			!racingLineSourceRef.current ||
			!carPositionSourceRef.current ||
			dataWithCoordinates.length === 0
		) {
			return;
		}

		racingLineSourceRef.current.clear();
		carPositionSourceRef.current.clear();

		try {
			// Filter points with valid GPS coordinates
			const validGPSPoints = dataWithCoordinates.filter(
				(point) => point.Lat && point.Lon && point.Lat !== 0 && point.Lon !== 0,
			);

			if (validGPSPoints.length === 0) {
				console.warn("No valid GPS coordinates found in telemetry data");
				return;
			}

			// Convert GPS coordinates to map projection
			const lineCoordinates = validGPSPoints.map((point) =>
				fromLonLat([point.Lon, point.Lat]),
			);

			// Create the racing line
			const lineFeature = new Feature({
				geometry: new LineString(lineCoordinates),
			});

			// Style based on speed
			const speedGradientStyle = createSpeedGradientStyle(validGPSPoints);
			lineFeature.setStyle(speedGradientStyle);

			racingLineSourceRef.current.addFeature(lineFeature);

			// Add speed-based segments for better visualization
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

				// Color based on speed
				const speedColor = getSpeedColor(point.Speed);
				segmentFeature.setStyle(
					new Style({
						stroke: new Stroke({
							color: speedColor,
							width: 6,
						}),
					}),
				);

				racingLineSourceRef.current.addFeature(segmentFeature);
			}

			// Add car position at start
			const startPoint = validGPSPoints[0];
			if (startPoint) {
				const carFeature = new Feature({
					geometry: new Point(fromLonLat([startPoint.Lon, startPoint.Lat])),
				});

				carPositionSourceRef.current.addFeature(carFeature);
			}

			// Fit view to racing line
			if (!isScrubbing) {
				const geometry = lineFeature.getGeometry();
				if (geometry) {
					olMapRef.current.getView().fit(geometry.getExtent(), {
						padding: [100, 100, 100, 100],
						duration: 1000,
						maxZoom: 18,
					});
				}
			}
		} catch (error) {
			console.error("Error rendering GPS-based racing line:", error);
		}
	}, [
		dataWithCoordinates,
		mapInitialized,
		isScrubbing,
		racingLineSourceRef,
		carPositionSourceRef,
	]);

	// Update selected marker
	useEffect(() => {
		if (!selectedMarkerSourceRef.current || dataWithCoordinates.length === 0) {
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
						radius: 10,
						fill: new Fill({
							color: "#00ffff",
						}),
						stroke: new Stroke({
							color: "#000000",
							width: 2,
						}),
					}),
					text: new Text({
						text: displayText,
						offsetY: -20,
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
			if (isScrubbing && olMapRef.current) {
				olMapRef.current.getView().animate({
					center: markerCoords,
					duration: 300,
				});
			}
		}
	}, [
		selectedPointIndex,
		dataWithCoordinates,
		isScrubbing,
		selectedMarkerSourceRef,
	]);

	// Helper function to create speed gradient style
	const createSpeedGradientStyle = (points: TelemetryDataPoint[]) => {
		const speeds = points.map((p) => p.Speed);
		const minSpeed = Math.min(...speeds);
		const maxSpeed = Math.max(...speeds);

		return new Style({
			stroke: new Stroke({
				color: "#ff0000",
				width: 4,
			}),
		});
	};

	// Helper function to get color based on speed
	const getSpeedColor = (speed: number): string => {
		// Normalize speed to 0-1 range (assuming max speed around 300 km/h)
		const normalizedSpeed = Math.min(speed / 300, 1);

		if (normalizedSpeed < 0.3) {
			// Low speed - red
			return "#ff0000";
		} else if (normalizedSpeed < 0.6) {
			// Medium speed - yellow
			return "#ffff00";
		} else {
			// High speed - green
			return "#00ff00";
		}
	};

	const handleZoomIn = (): void => {
		if (olMapRef.current) {
			const view = olMapRef.current.getView();
			view.animate({
				zoom: view.getZoom()! + 0.5,
				duration: 250,
			});
		}
	};

	const handleZoomOut = (): void => {
		if (olMapRef.current) {
			const view = olMapRef.current.getView();
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

			{/* Legend */}
			<div className="absolute top-2 right-2 z-10 bg-gray-700 bg-opacity-90 p-2 rounded text-white text-xs">
				<div className="flex items-center gap-2 mb-1">
					<div className="w-4 h-1 bg-red-500"></div>
					<span>Low Speed</span>
				</div>
				<div className="flex items-center gap-2 mb-1">
					<div className="w-4 h-1 bg-yellow-500"></div>
					<span>Medium Speed</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-4 h-1 bg-green-500"></div>
					<span>High Speed</span>
				</div>
			</div>

			{/* Map container */}
			<div ref={mapContainerRef} className="w-full h-full" />
		</div>
	);
}
