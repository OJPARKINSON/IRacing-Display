"use client";
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
export interface TelemetryDataPoint {
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
  coordinates?: [number, number]; // Added for storing calculated coordinates
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
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null
  );
  const hoverMarkerSourceRef = useRef<VectorSource | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const selectedMarkerSourceRef = useRef<VectorSource | null>(null);

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

  useEffect(() => {
    if (
      !mapInitialized ||
      !olMapRef.current ||
      !racingLineSourceRef.current ||
      !carPositionSourceRef.current ||
      !hoverMarkerSourceRef.current ||
      !svgLoaded ||
      !trackPath ||
      telemetryData.length === 0
    ) {
      return;
    }

    // Clear hover marker when point changes
    hoverMarkerSourceRef.current.clear();

    // Add hover marker if there's a hovered point
    if (
      hoveredPointIndex !== null &&
      hoveredPointIndex >= 0 &&
      hoveredPointIndex < telemetryData.length
    ) {
      const hoveredPoint = telemetryData[hoveredPointIndex];

      // If this point has coordinates (already calculated)
      if (hoveredPoint.coordinates) {
        const hoverFeature = new Feature({
          geometry: new Point(hoveredPoint.coordinates),
        });

        hoverMarkerSourceRef.current.addFeature(hoverFeature);
      }
    }
  }, [hoveredPointIndex, telemetryData, mapInitialized, svgLoaded]);

  // Initialize OpenLayers map
  useEffect(() => {
    if (mapInitialized || !mapContainerRef.current) return;

    const initializeMap = (): void => {
      // SVG dimensions
      const svgWidth = 1556;
      const svgHeight = 783;
      const extent = [0, 0, svgWidth, svgHeight];

      // Create custom projection for the SVG - with no rotation
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

      const selectedMarkerSource = new VectorSource();
      selectedMarkerSourceRef.current = selectedMarkerSource;

      const selectedMarkerLayer = new VectorLayer({
        source: selectedMarkerSource,
        style: new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({
              color: "#00ffff", // Cyan for better visibility
            }),
            stroke: new Stroke({
              color: "#000000",
              width: 2,
            }),
          }),
        }),
        zIndex: 100, // Ensure it's above other layers
      });

      // Create the map
      const map = new Map({
        target: mapContainerRef.current!,
        layers: [
          trackLayer,
          racingLineLayer,
          carPositionLayer,
          selectedMarkerLayer,
        ], // Add hover marker layer
        controls: defaultControls({ zoom: false, rotate: false }),
        view: new View({
          projection: projection,
          center: getCenter(extent),
          zoom: 2,
          rotation: 0,
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

  // Detect and find the start-finish line position
  const findStartFinishPosition = (
    pathElement: SVGPathElement,
    telemetryData: TelemetryDataPoint[]
  ): number => {
    // Try to find points near 0% and 100% lap distance
    const nearZero = telemetryData.filter(
      (p) => p.LapDistPct < 1 || p.LapDistPct > 99
    );

    if (nearZero.length === 0) {
      // Default to 0 if no clear start/finish
      return 0;
    }

    // Find the average lap distance of points near 0%
    const avgPosition =
      nearZero.reduce(
        (sum, p) => sum + (p.LapDistPct > 90 ? 0 : p.LapDistPct),
        0
      ) / nearZero.length;

    // Convert to offset percentage (negative value)
    return -avgPosition;
  };

  // Calculate racing line coordinates with vertical position adjustment
  const calculateRacingLineCoordinates = (
    telemetryData: TelemetryDataPoint[]
  ): TelemetryDataPoint[] => {
    if (!trackPath || !svgContainerRef.current || telemetryData.length === 0) {
      return telemetryData;
    }

    try {
      const pathElement = svgContainerRef.current.querySelector(
        "#track-outline"
      ) as SVGPathElement;
      if (!pathElement) return telemetryData;

      // Get track path total length
      const totalLength = pathElement.getTotalLength();

      // Fine-tune values for Monza
      const rotationAngle = 90; // Keep the working rotation
      const insideTrackFactor = 1; // Positive to keep line inside track

      // Now map each telemetry point to track coordinates
      return telemetryData.map((point) => {
        // Get position on track path
        const position = (point.LapDistPct / 100) * totalLength;
        const basePoint = pathElement.getPointAtLength(position);

        // Calculate racing line offset based on driving inputs
        let offsetX = 0;
        let offsetY = 0;

        // Use steering to determine racing line offset
        const steeringFactor = point.SteeringWheelAngle / 50;

        if (Math.abs(steeringFactor) > 0.1) {
          // Get direction along track
          const stepSize = totalLength / 200;
          const prevPosition = Math.max(0, position - stepSize);
          const nextPosition = Math.min(totalLength, position + stepSize);

          const prevPoint = pathElement.getPointAtLength(prevPosition);
          const nextPoint = pathElement.getPointAtLength(nextPosition);

          // Calculate direction
          const dirX = nextPoint.x - prevPoint.x;
          const dirY = nextPoint.y - prevPoint.y;
          const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
          const normDirX = dirLength > 0 ? dirX / dirLength : 0;
          const normDirY = dirLength > 0 ? dirY / dirLength : 0;

          // Get perpendicular vector
          const perpDirX = -normDirY;
          const perpDirY = normDirX;

          // Calculate offset magnitude based on driving factors
          const speedFactor = point.Speed / 250;
          const throttleFactor = point.Throttle / 100;
          const brakeFactor = point.Brake / 100;

          // Use a smaller overall offset to keep line inside track
          let offsetMagnitude = Math.min(18, Math.abs(steeringFactor * 50));

          // Speed influence
          offsetMagnitude *= 1 + speedFactor * 0.8;

          // Braking influence
          if (brakeFactor > 0.3) {
            offsetMagnitude *= 1 - brakeFactor * 0.2;
          }

          // Throttle influence
          if (throttleFactor > 0.7 && Math.abs(steeringFactor) > 0.2) {
            offsetMagnitude *= 1 + throttleFactor * 0.1;
          }

          // Apply offset with sign to keep line inside track
          offsetX =
            perpDirX *
            offsetMagnitude *
            Math.sign(steeringFactor) *
            insideTrackFactor;
          offsetY =
            perpDirY *
            offsetMagnitude *
            Math.sign(steeringFactor) *
            insideTrackFactor;
        }

        // Apply rotation to match map orientation
        const radians = (rotationAngle * Math.PI) / 180;
        const rotatedX =
          (basePoint.x + offsetX) * Math.cos(radians) -
          (basePoint.y + offsetY) * Math.sin(radians);
        const rotatedY =
          (basePoint.x + offsetX) * Math.sin(radians) +
          (basePoint.y + offsetY) * Math.cos(radians);

        // Apply vertical position adjustment
        const finalX = rotatedX;
        const finalY = rotatedY + 700; // Apply vertical offset

        // Return coordinates
        return {
          ...point,
          coordinates: [finalY, finalX] as [number, number],
        };
      });
    } catch (error) {
      console.error("Error calculating racing line coordinates:", error);
      return telemetryData;
    }
  };

  // Update the racing line rendering effect - stays the same as before
  const dataWithCoordinates = useMemo(() => {
    if (!telemetryData.length || !trackPath || !svgContainerRef.current) {
      return [];
    }

    try {
      // Get the path element
      const pathElement = svgContainerRef.current.querySelector(
        "#track-outline"
      ) as SVGPathElement;
      if (!pathElement) return [];

      // Get track path total length
      const totalLength = pathElement.getTotalLength();

      // Fine-tune values for Monza
      const rotationAngle = 90; // Keep the working rotation
      const insideTrackFactor = 1; // Positive to keep line inside track
      const verticalOffset = -120; // Adjust this value to move racing line up/down

      // Calculate coordinates for all points at once
      return telemetryData.map((point) => {
        // Get position on track path
        const position = (point.LapDistPct / 100) * totalLength;
        const basePoint = pathElement.getPointAtLength(position);

        // Calculate racing line offset based on driving inputs
        let offsetX = 0;
        let offsetY = 0;

        // Use steering to determine racing line offset
        const steeringFactor = point.SteeringWheelAngle / 15;

        if (Math.abs(steeringFactor) > 0.1) {
          // Get direction along track
          const stepSize = totalLength / 200;
          const prevPosition = Math.max(0, position - stepSize);
          const nextPosition = Math.min(totalLength, position + stepSize);

          const prevPoint = pathElement.getPointAtLength(prevPosition);
          const nextPoint = pathElement.getPointAtLength(nextPosition);

          // Calculate direction
          const dirX = nextPoint.x - prevPoint.x;
          const dirY = nextPoint.y - prevPoint.y;
          const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
          const normDirX = dirLength > 0 ? dirX / dirLength : 0;
          const normDirY = dirLength > 0 ? dirY / dirLength : 0;

          // Get perpendicular vector
          const perpDirX = -normDirY;
          const perpDirY = normDirX;

          // Calculate offset magnitude based on driving factors
          const speedFactor = point.Speed / 250;
          const throttleFactor = point.Throttle / 100;
          const brakeFactor = point.Brake / 100;

          // Use a smaller overall offset to keep line inside track
          let offsetMagnitude = Math.min(18, Math.abs(steeringFactor * 12));

          // Speed influence
          offsetMagnitude *= 1 + speedFactor * 0.3;

          // Braking influence
          if (brakeFactor > 0.3) {
            offsetMagnitude *= 1 - brakeFactor * 0.2;
          }

          // Throttle influence
          if (throttleFactor > 0.7 && Math.abs(steeringFactor) > 0.2) {
            offsetMagnitude *= 1 + throttleFactor * 0.1;
          }

          // Apply offset with sign to keep line inside track
          offsetX =
            perpDirX *
            offsetMagnitude *
            Math.sign(steeringFactor) *
            insideTrackFactor;
          offsetY =
            perpDirY *
            offsetMagnitude *
            Math.sign(steeringFactor) *
            insideTrackFactor;
        }

        // Apply rotation to match map orientation
        const radians = (rotationAngle * Math.PI) / 180;
        const rotatedX =
          (basePoint.x + offsetX) * Math.cos(radians) -
          (basePoint.y + offsetY) * Math.sin(radians);
        const rotatedY =
          (basePoint.x + offsetX) * Math.sin(radians) +
          (basePoint.y + offsetY) * Math.cos(radians);

        // Apply vertical position adjustment
        const finalX = rotatedX;
        const finalY = rotatedY + verticalOffset; // Apply vertical offset

        // Return data point with calculated coordinates
        return {
          ...point,
          coordinates: [finalY, finalX] as [number, number],
        };
      });
    } catch (error) {
      console.error("Error calculating coordinates:", error);
      return [];
    }
  }, [telemetryData, svgLoaded, trackPath]);

  // Update the useEffect to render the racing line with the pre-calculated coordinates
  useEffect(() => {
    if (
      !mapInitialized ||
      !olMapRef.current ||
      !racingLineSourceRef.current ||
      !carPositionSourceRef.current ||
      !selectedMarkerSourceRef.current ||
      !svgLoaded ||
      !trackPath ||
      dataWithCoordinates.length === 0
    ) {
      return;
    }

    // Clear previous features
    racingLineSourceRef.current.clear();
    carPositionSourceRef.current.clear();

    try {
      // Extract coordinates for the racing line
      const lineCoordinates = dataWithCoordinates
        .filter((point) => point.coordinates)
        .map((point) => point.coordinates as [number, number]);

      if (lineCoordinates.length > 0) {
        // Create racing line feature
        const lineFeature = new Feature({
          geometry: new LineString(lineCoordinates),
        });

        // Add racing line to source
        racingLineSourceRef.current.addFeature(lineFeature);

        // Find the start point for car marker (closest to 0% lap distance)
        const startPoints = dataWithCoordinates.filter((p) => p.LapDistPct < 1);
        const carPoint =
          startPoints.length > 0 ? startPoints[0] : dataWithCoordinates[0];

        if (carPoint.coordinates) {
          // Create car position feature
          const carFeature = new Feature({
            geometry: new Point(carPoint.coordinates),
          });

          carPositionSourceRef.current.addFeature(carFeature);
        }

        // Fit view to racing line (only on initial load)
        if (!isScrubbing) {
          const geo = lineFeature.getGeometry();
          if (geo) {
            olMapRef.current.getView().fit(geo.getExtent(), {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error rendering racing line:", error);
    }
  }, [dataWithCoordinates, mapInitialized, svgLoaded, trackPath, isScrubbing]);

  // Add a separate effect to update the selected point marker
  // This is separate to avoid re-rendering the entire racing line when scrubbing
  useEffect(() => {
    if (
      !selectedMarkerSourceRef.current ||
      dataWithCoordinates.length === 0 ||
      selectedPointIndex >= dataWithCoordinates.length
    ) {
      return;
    }

    // Clear previous marker
    selectedMarkerSourceRef.current.clear();

    // Get the selected point
    const selectedPoint = dataWithCoordinates[selectedPointIndex];

    if (selectedPoint && selectedPoint.coordinates) {
      // Create marker feature
      const markerFeature = new Feature({
        geometry: new Point(selectedPoint.coordinates),
      });

      // Add marker to source
      selectedMarkerSourceRef.current.addFeature(markerFeature);

      // Update the information display
      // You might want to set additional state here to show details about this point
    }
  }, [selectedPointIndex, dataWithCoordinates]);

  // Create a performant scrubber component
  const TelemetryScrubber = ({
    data,
    selectedIndex,
    onIndexChange,
  }: {
    data: TelemetryDataPoint[];
    selectedIndex: number;
    onIndexChange: (index: number) => void;
  }) => {
    // Scrubber input is separate from the chart to improve performance
    const handleScrubberChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const index = parseInt(e.target.value, 10);
        onIndexChange(index);
      },
      [onIndexChange]
    );

    // Only create the labels once for better performance
    const timeLabels = useMemo(() => {
      if (!data.length) return [];
      const startTime = data[0].sessionTime;
      const endTime = data[data.length - 1].sessionTime;

      return [
        startTime.toFixed(2) + "s",
        ((endTime - startTime) / 2 + startTime).toFixed(2) + "s",
        endTime.toFixed(2) + "s",
      ];
    }, [data]);

    return (
      <div className="py-4">
        <div className="flex justify-between text-gray-400 text-xs mb-1">
          {timeLabels.map((label, i) => (
            <span key={i} className={i === 1 ? "flex-1 text-center" : ""}>
              {label}
            </span>
          ))}
        </div>
        <input
          type="range"
          min="0"
          max={data.length > 0 ? data.length - 1 : 0}
          value={selectedIndex}
          onChange={handleScrubberChange}
          onMouseDown={() => setIsScrubbing(true)}
          onMouseUp={() => setIsScrubbing(false)}
          onTouchStart={() => setIsScrubbing(true)}
          onTouchEnd={() => setIsScrubbing(false)}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    );
  };
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
          telemetryData={dataWithCoordinates}
          selectedIndex={selectedPointIndex}
          onIndexChange={setSelectedPointIndex}
        />
      </div>

      {/* Additional Telemetry Information */}
      {!isLoading && !error && telemetryData.length > 0 && (
        <InfoBox telemetryData={telemetryData} lapId={lapId} />
      )}
    </div>
  );
}
