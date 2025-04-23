"use client";

import { TelemetryChart, InfoBox } from "@/components/InfoBox";
import { telemetryFetcher } from "@/lib/fetch";
import { useSearchParams } from "next/navigation";
import { use, useState } from "react";
import useSWR from "swr";
import { TelemetryDataPoint } from "@/lib/types";
import { useTelemetryData } from "@/hooks/useTelemetryData";
import { useTrackPosition } from "@/hooks/useTrackPosition";
import { useSvgTrack } from "@/hooks/useSvgTrack";
import TrackMap from "@/components/trackMap";

interface Params {
  params: Promise<{
    sessionId: string;
  }>;
}

export default function TelemetryPage({ params }: Params) {
  const searchParams = useSearchParams();
  const lapId = searchParams.get("lapId");
  const { sessionId } = use(params);

  const isClockwise = 0;

  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(0);
  const [selectedMetric, setSelectedMetric] = useState<string>("Speed");

  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Custom hook for track SVG loading
  const {
    svgLoaded,
    trackPath,
    startFinishPosition,
    svgContainerRef,
    svgError,
  } = useSvgTrack();

  // Fetch telemetry data
  const { data: telemetry, error: telError } = useSWR(
    `/api/telemetry?sessionId=telemetry_${sessionId}&lapId=${lapId}`,
    telemetryFetcher
  );

  // Process telemetry data with track path
  const { dataWithCoordinates, processError } = useTelemetryData(
    telemetry,
    trackPath,
    startFinishPosition,
    svgContainerRef,
    isClockwise
  );

  const {
    selectedIndex,
    selectedLapPct,
    handlePointSelection,
    getTrackDisplayPoint,
  } = useTrackPosition(dataWithCoordinates as TelemetryDataPoint[]);

  // Set errors
  if (telError && !error) setError(telError.message);
  if (svgError && !error) setError(svgError);
  if (processError && !error) setError(processError);

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">iRacing Telemetry Dashboard</h1>
      <SessionInfo sessionId={sessionId} lapId={lapId} />

      {renderErrorMessage(error)}
      {renderLoadingMessage(telemetry, error)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Track Map */}
        <div className="col-span-1 lg:col-span-2 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">
            Monza Track Map & Racing Line
          </h2>

          <TrackMap
            svgContainerRef={svgContainerRef}
            dataWithCoordinates={dataWithCoordinates}
            selectedPointIndex={selectedIndex}
            selectedLapPct={selectedLapPct}
            isScrubbing={isScrubbing}
            getTrackDisplayPoint={getTrackDisplayPoint}
          />
        </div>

        <div>
          <TelemetryChart
            selectedMetric={selectedMetric}
            setSelectedMetric={setSelectedMetric}
            availableMetrics={availableMetrics}
            telemetryData={dataWithCoordinates as TelemetryDataPoint[]}
            selectedIndex={selectedIndex}
            onIndexChange={(index) => {
              handlePointSelection(index);
              setIsScrubbing(true);
              setTimeout(() => setIsScrubbing(false), 500);
            }}
          />
        </div>
      </div>

      {/* Telemetry Details */}
      {telemetry && dataWithCoordinates.length > 0 && lapId && (
        <InfoBox
          telemetryData={dataWithCoordinates as TelemetryDataPoint[]}
          lapId={lapId}
        />
      )}
    </div>
  );
}

// Component for displaying session information
function SessionInfo({
  sessionId,
  lapId,
}: {
  sessionId: string;
  lapId: string | null;
}) {
  return (
    <div className="mb-4 text-gray-300">
      <p>Session: {sessionId}</p>
      <p>Lap: {lapId}</p>
    </div>
  );
}

// Function to render error message
function renderErrorMessage(error: string | null) {
  if (!error) return null;

  return (
    <div className="bg-red-900 text-white p-3 rounded mb-4">
      <p className="font-semibold">Error</p>
      <p>{error}</p>
    </div>
  );
}

// Function to render loading message
function renderLoadingMessage(telemetry: any, error: string | null) {
  if (telemetry !== undefined || error !== null) return null;

  return (
    <div className="bg-gray-800 text-white p-4 rounded mb-4 text-center">
      <p className="animate-pulse">Loading telemetry data...</p>
    </div>
  );
}

// Available metrics for the telemetry chart
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
