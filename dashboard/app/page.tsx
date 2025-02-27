"use client";
import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { InfoBox, TelemetryChart } from "@/components/InfoBox";
import Map from "ol/Map";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Stroke, Circle, Fill } from "ol/style";
import { DragPan, MouseWheelZoom } from "ol/interaction";
import { defaults as defaultControls } from "ol/control";
import Projection from "ol/proj/Projection";
import { getCenter } from "ol/extent";
import Feature from "ol/Feature";
import { LineString, Point } from "ol/geom";
import ImageLayer from "ol/layer/Image";
import ImageStatic from "ol/source/ImageStatic";
import "ol/ol.css";

export interface SessionInfo {
  id: string;
  bucket: string;
}

// Type for telemetry data point
interface TelemetryDataPoint {
  index: number;
  time: number;
  sessionTime: number;
  Speed: number;
  RPM: number;
  Throttle: number;
  Brake: number;
  Gear: number;
  LapDistPct: number;
  SteeringWheelAngle: number;
  Lat: number;
  Lon: number;
  VelocityX: number;
  VelocityY: number;
  FuelLevel: number;
  LapCurrentLapTime: number;
  PlayerCarPosition: number;
}

// Type for raw telemetry data from API
interface RawTelemetryData {
  _time?: number;
  session_time?: number;
  speed?: number;
  rpm?: number;
  throttle?: number;
  brake?: number;
  gear?: number;
  lap_dist_pct?: number;
  steering_wheel_angle?: number;
  lat?: number;
  lon?: number;
  velocity_x?: number;
  velocity_y?: number;
  fuel_level?: number;
  lap_current_lap_time?: number;
  player_car_position?: number;
}

// Type for telemetry response from API
interface TelemetryResponse {
  data: RawTelemetryData[];
}

export default function TelemetryDashboard(): JSX.Element {
  const searchParams = useSearchParams();
  const olMapRef = useRef<Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const racingLineSourceRef = useRef<VectorSource | null>(null);
  const carPositionSourceRef = useRef<VectorSource | null>(null);

  // State management
  const [mapInitialized, setMapInitialized] = useState<boolean>(false);
  const [svgLoaded, setSvgLoaded] = useState<boolean>(false);
  const [selectedMetric, setSelectedMetric] = useState<string>("Speed");
  const [telemetryData, setTelemetryData] = useState<TelemetryDataPoint[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [lapId, setLapId] = useState<string>("");
  const [availableSessions, setAvailableSessions] = useState<SessionInfo[]>([]);
  const [availableLaps, setAvailableLaps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trackPath, setTrackPath] = useState<SVGPathElement | null>(null);

  // Available telemetry metrics for display
  const availableMetrics: string[] = [
    "Lap",
    "LapDistPct",
    "Speed",
    "Throttle",
    "Brake",
    "Gear",
    "RPM",
    "SteeringWheelAngle",
    "VelocityX",
    "VelocityY",
    "Lat",
    "Lon",
    "SessionTime",
    "LapCurrentLapTime",
    "PlayerCarPosition",
    "FuelLevel",
  ];

  // Load SVG and extract track path data
  useEffect(() => {
    if (svgLoaded || !svgContainerRef.current) return;

    const loadSvg = async (): Promise<void> => {
      try {
        const response = await fetch("http://localhost:3000/track-monza.svg");
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
        }

        const svgText = await response.text();

        // Parse SVG to extract path data
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
        const pathElement = svgDoc.getElementById(
          "track-outline"
        ) as SVGPathElement | null;

        if (pathElement) {
          setTrackPath(pathElement);
          svgContainerRef.current!.innerHTML = svgText;
          setSvgLoaded(true);
        } else {
          throw new Error("Track path not found in SVG");
        }
      } catch (error) {
        console.error("Error loading SVG:", error);
        setError("Failed to load track. Please refresh and try again.");
      }
    };

    loadSvg();
  }, [svgContainerRef.current]);

  // Initialize OpenLayers map
  useEffect(() => {
    if (mapInitialized || !mapContainerRef.current) return;

    const initializeMap = (): void => {
      // SVG dimensions
      const svgWidth = 1556;
      const svgHeight = 783;
      const extent = [0, 0, svgWidth, svgHeight];

      // Create custom projection for the SVG
      const projection = new Projection({
        code: "svg-pixels",
        units: "pixels",
        extent: extent,
      });

      // Create vector source for the racing line
      const racingLineSource = new VectorSource();
      racingLineSourceRef.current = racingLineSource;

      const racingLineLayer = new VectorLayer({
        source: racingLineSource,
        style: new Style({
          stroke: new Stroke({
            color: "#f56565", // Red color for racing line
            width: 3,
          }),
        }),
      });

      // Car position source
      const carPositionSource = new VectorSource();
      carPositionSourceRef.current = carPositionSource;

      const carPositionLayer = new VectorLayer({
        source: carPositionSource,
        style: new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({
              color: "#00ff00",
            }),
          }),
        }),
      });

      // Create Static image source for track
      const trackImageSource = new ImageStatic({
        url: "http://localhost:3000/track-monza.svg",
        projection: projection,
        imageExtent: extent,
      });

      const trackLayer = new ImageLayer({
        source: trackImageSource,
      });

      // Create the map
      const map = new Map({
        target: mapContainerRef.current!,
        layers: [trackLayer, racingLineLayer, carPositionLayer],
        controls: defaultControls({ zoom: false, rotate: false }),
        view: new View({
          projection: projection,
          center: getCenter(extent),
          zoom: 2,
          rotation: 0, // No rotation
          maxZoom: 8,
          minZoom: 1,
          extent: [
            -svgWidth * 0.5,
            -svgHeight * 0.5,
            svgWidth * 1.5,
            svgHeight * 1.5,
          ],
        }),
      });

      // Add interactions
      map.addInteraction(new DragPan());
      map.addInteraction(new MouseWheelZoom());

      // Store the map reference
      olMapRef.current = map;

      // Mark initialization as complete
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
      }
    };
  }, []);

  // Get session and lap from URL parameters on initial load
  useEffect(() => {
    const sessionFromUrl = searchParams.get("session");
    const lapFromUrl = searchParams.get("lap");

    if (sessionFromUrl) {
      setSessionId(sessionFromUrl);
    }

    if (lapFromUrl) {
      setLapId(lapFromUrl);
    }
  }, [searchParams]);

  // Update URL when session or lap changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (sessionId) {
      params.set("session", sessionId);
    }
    if (lapId) {
      params.set("lap", lapId);
    }
    window.history.replaceState({}, "", `?${params.toString()}`);
  }, [sessionId, lapId]);

  // Fetch available sessions
  useEffect(() => {
    const fetchSessions = async (): Promise<void> => {
      try {
        const response = await fetch("/api/sessions");
        if (!response.ok) {
          throw new Error(`Failed to fetch sessions: ${response.statusText}`);
        }

        const data: SessionInfo[] = await response.json();
        if (data && data.length > 0) {
          setAvailableSessions(data);

          // Only set default session if not already set from URL
          if (!sessionId && data.length > 0) {
            setSessionId(data[0].bucket);
          }
        } else {
          setError("No sessions available");
        }
      } catch (err) {
        console.error("Error fetching sessions:", err);
        setError(
          err instanceof Error ? err.message : "Unknown error fetching sessions"
        );
      }
    };

    fetchSessions();
  }, []);

  // Fetch available laps for the selected session
  useEffect(() => {
    if (!sessionId) return;

    const fetchLaps = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/laps?sessionId=${sessionId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch laps: ${response.statusText}`);
        }

        const data: { laps: string[] } = await response.json();
        if (data.laps && data.laps.length > 0) {
          setAvailableLaps(data.laps);

          // Only set default lap if not already set from URL or if current lap isn't in the new list
          if ((!lapId || !data.laps.includes(lapId)) && data.laps.length > 0) {
            setLapId(data.laps[0]);
          }
        } else {
          setError("No laps available for this session");
        }
      } catch (err) {
        console.error("Error fetching laps:", err);
        setError(
          err instanceof Error ? err.message : "Unknown error fetching laps"
        );
      }
    };

    fetchLaps();
  }, [sessionId]);

  // Fetch telemetry data for the selected session and lap
  useEffect(() => {
    if (!sessionId || !lapId) return;

    setIsLoading(true);

    const fetchTelemetryData = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/telemetry?sessionId=${sessionId}&lapId=${lapId}`
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch telemetry data: ${response.statusText}`
          );
        }

        const data: TelemetryResponse = await response.json();

        if (!data || !data.data || data.data.length === 0) {
          setError(
            "No telemetry data available for the selected session and lap"
          );
          setIsLoading(false);
          return;
        }

        setError(null);
        processData(data);
      } catch (err) {
        console.error("Error fetching telemetry data:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error fetching telemetry data"
        );
        setIsLoading(false);
      }
    };

    fetchTelemetryData();
  }, [sessionId, lapId]);

  // Process telemetry data
  const processData = (data: TelemetryResponse): void => {
    // Sort data by session_time to ensure correct order
    const sortedData = [...data.data].sort((a, b) => {
      const timeA = a.session_time !== undefined ? a.session_time : 0;
      const timeB = b.session_time !== undefined ? b.session_time : 0;
      return timeA - timeB;
    });

    // Prepare telemetry data for charts
    const processedData: TelemetryDataPoint[] = sortedData.map((d, i) => ({
      index: i,
      time: d._time || i,
      sessionTime: d.session_time || 0,
      Speed: d.speed || 0,
      RPM: d.rpm || 0,
      Throttle: (d.throttle || 0) * 100,
      Brake: (d.brake || 0) * 100,
      Gear: d.gear || 0,
      LapDistPct: (d.lap_dist_pct || 0) * 100,
      SteeringWheelAngle: d.steering_wheel_angle || 0,
      Lat: d.lat || 0,
      Lon: d.lon || 0,
      VelocityX: d.velocity_x || 0,
      VelocityY: d.velocity_y || 0,
      FuelLevel: d.fuel_level || 0,
      LapCurrentLapTime: d.lap_current_lap_time || 0,
      PlayerCarPosition: d.player_car_position || 0,
    }));

    setTelemetryData(processedData);
    setIsLoading(false);
  };

  // Use SVG path data to map lap distance to coordinates with an offset for proper racing line
  const mapLapDistanceToCoordinates = (
    lapDistPct: number,
    isRacingLine: boolean = true
  ): [number, number] => {
    if (!trackPath || !svgContainerRef.current) {
      // Default coordinates for Monza start/finish straight
      return [1115, 768];
    }

    try {
      const pathElement = svgContainerRef.current.querySelector(
        "#track-outline"
      ) as SVGPathElement;
      if (!pathElement) return [1115, 768];

      const totalLength = pathElement.getTotalLength();
      const position = (lapDistPct / 100) * totalLength;
      const point = pathElement.getPointAtLength(position);

      if (!isRacingLine) {
        // Return exact path position for car marker
        return [point.x, point.y];
      }

      // Get points before and after to determine direction
      const stepSize = totalLength / 100;
      const prevPosition = Math.max(0, position - stepSize);
      const nextPosition = Math.min(totalLength, position + stepSize);

      const prevPoint = pathElement.getPointAtLength(prevPosition);
      const nextPoint = pathElement.getPointAtLength(nextPosition);

      // Calculate direction vector
      const dirX = nextPoint.x - prevPoint.x;
      const dirY = nextPoint.y - prevPoint.y;

      // Normalize the vector
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      const normDirX = length > 0 ? dirX / length : 0;
      const normDirY = length > 0 ? dirY / length : 0;

      // Get perpendicular vector (90 degrees counter-clockwise)
      const perpDirX = -normDirY;
      const perpDirY = normDirX;

      // Apply offset for racing line (inside of corners)
      // Determine the racing line offset based on track position
      // Monza needs specific offsets for different sections
      let offset = 25; // Default offset

      // Change the sign to flip the racing line
      const flipFactor = -0.5;

      // Return point with offset
      return [
        point.x + perpDirX * offset * flipFactor,
        point.y + perpDirY * offset * flipFactor,
      ];
    } catch (error) {
      console.error("Error mapping lap distance to coordinates:", error);
      return [1115, 768]; // Fallback to default position
    }
  };

  // Generate racing line with varying offsets to follow proper racing line
  const generateRacingLine = (sortedData: TelemetryDataPoint[]): number[][] => {
    if (!trackPath) return [];

    const totalLength = trackPath.getTotalLength();
    const numPoints = 200; // Use more points for a smoother line
    const coordinates: number[][] = [];

    // Use equal spacing around the track for a smoother line
    for (let i = 0; i < numPoints; i++) {
      const lapPct = (i / numPoints) * 100;

      // Use custom offsets for different track sections to follow racing line
      let offsetMultiplier = 1.0;

      // Adjust offset for different sections of Monza
      if (lapPct < 5 || lapPct > 95) {
        // Start/finish straight - smaller offset
        offsetMultiplier = 0.5;
      } else if (lapPct > 10 && lapPct < 20) {
        // First chicane - large offset
        offsetMultiplier = 1.5;
      } else if (lapPct > 30 && lapPct < 40) {
        // Lesmo corners - medium-large offset
        offsetMultiplier = 1.2;
      } else if (lapPct > 50 && lapPct < 60) {
        // Ascari chicane - largest offset
        offsetMultiplier = 1.8;
      } else if (lapPct > 70 && lapPct < 90) {
        // Parabolica - gradually decreasing offset
        offsetMultiplier = 1.4 - ((lapPct - 70) / 20) * 0.9;
      }

      // Apply custom offset to create a more realistic racing line
      coordinates.push(mapLapDistanceToCoordinates(lapPct));
    }

    // Ensure the line is closed
    if (coordinates.length > 0) {
      coordinates.push(coordinates[0]);
    }

    return coordinates;
  };

  // Update racing line and car position when telemetry data changes
  useEffect(() => {
    if (
      !mapInitialized ||
      !olMapRef.current ||
      !telemetryData.length ||
      !racingLineSourceRef.current ||
      !carPositionSourceRef.current ||
      !svgLoaded ||
      !trackPath
    ) {
      return;
    }

    // Clear previous features
    racingLineSourceRef.current.clear();
    carPositionSourceRef.current.clear();

    try {
      // Sort data by lap distance percentage
      const sortedData = [...telemetryData].sort(
        (a, b) => a.LapDistPct - b.LapDistPct
      );

      // Generate racing line with proper offsets for a realistic line
      const coordinates = generateRacingLine(sortedData);

      // Create racing line feature
      const lineFeature = new Feature({
        geometry: new LineString(coordinates),
      });

      racingLineSourceRef.current.addFeature(lineFeature);

      // Find point for car position (near start/finish line)
      const startFinishPoint = sortedData[0];

      // Use exact track path for car position (no offset)
      const carPosition = mapLapDistanceToCoordinates(
        startFinishPoint.LapDistPct,
        true
      );

      // Create car position feature
      const carFeature = new Feature({
        geometry: new Point(carPosition),
      });

      carPositionSourceRef.current.addFeature(carFeature);

      // Fit view to racing line
      const geo = lineFeature.getGeometry();
      if (geo) {
        olMapRef.current.getView().fit(geo.getExtent(), {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    } catch (error) {
      console.error("Error rendering racing line:", error);
    }
  }, [telemetryData, mapInitialized, svgLoaded, trackPath]);

  // Map zoom controls
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
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">iRacing Telemetry Dashboard</h1>

      {/* Session and Lap Selection */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Session
          </label>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full bg-gray-700 text-white p-2 rounded"
            disabled={availableSessions.length === 0 || isLoading}
          >
            {availableSessions.length === 0 ? (
              <option>Loading sessions...</option>
            ) : (
              availableSessions.map((session) => (
                <option key={session.bucket} value={session.bucket}>
                  {session.bucket}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Lap
          </label>
          <select
            value={lapId}
            onChange={(e) => setLapId(e.target.value)}
            className="w-full bg-gray-700 text-white p-2 rounded"
            disabled={availableLaps.length === 0 || isLoading}
          >
            {availableLaps.length === 0 ? (
              <option>Select a session first</option>
            ) : (
              availableLaps.map((lap) => (
                <option key={lap} value={lap}>
                  Lap {lap}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900 text-white p-3 rounded mb-4">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="bg-gray-800 text-white p-4 rounded mb-4 text-center">
          <p className="animate-pulse">Loading telemetry data...</p>
        </div>
      )}

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Track Map with OpenLayers */}
        <div className="col-span-1 lg:col-span-2 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">
            Monza Track Map & Racing Line
          </h2>
          <div className="h-[500px] bg-gray-800 rounded-lg relative">
            {/* Zoom controls */}
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

            {/* Hidden SVG container for path calculations */}
            <div
              ref={svgContainerRef}
              style={{
                position: "absolute",
                width: "0",
                height: "0",
                visibility: "hidden",
                overflow: "hidden",
              }}
            ></div>

            {/* OpenLayers map container */}
            <div
              ref={mapContainerRef}
              className="w-full h-full"
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                zIndex: 1,
              }}
            ></div>
          </div>
        </div>

        {/* Telemetry Chart */}
        <TelemetryChart
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
          availableMetrics={availableMetrics}
          telemetryData={telemetryData}
        />
      </div>

      {/* Additional Telemetry Information */}
      {!isLoading && !error && telemetryData.length > 0 && (
        <InfoBox telemetryData={telemetryData} lapId={lapId} />
      )}
    </div>
  );
}
