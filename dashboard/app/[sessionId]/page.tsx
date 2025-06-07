"use client";

import { useSearchParams, useRouter, ReadonlyURLSearchParams } from "next/navigation";
import { usePathname } from 'next/navigation';
import { use, useState } from "react";
import useSWR from "swr";

import { TelemetryChart, InfoBox } from "@/components/InfoBox";
import { fetcher, telemetryFetcher } from "../../lib/Fetch";
import { useTelemetryData } from "@/hooks/useTelemetryData";
import { useTrackPosition } from "@/hooks/useTrackPosition";
import { useSvgTrack } from "@/hooks/useSvgTrack";
import TrackMap from "@/components/trackMap";
import { TelemetryDataPoint } from "@/lib/types";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

interface Params {
  params: Promise<{
    sessionId: string;
  }>;
}

export default function TelemetryPage({ params }: Params) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lapId = searchParams.get("lapId");
  const { sessionId } = use(params);

  const isClockwise = 0;

  const [selectedMetric, setSelectedMetric] = useState<string>("Speed");

  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const {
    svgLoaded,
    trackPath,
    startFinishPosition,
    svgContainerRef,
    svgError,
  } = useSvgTrack();

  const { data: telemetry, error: telError } = useSWR(
    `/api/telemetry?sessionId=telemetry_${sessionId}&lapId=${lapId}`,
    telemetryFetcher
  );


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

  if (telError && !error) setError(telError.message);
  if (svgError && !error) setError(svgError);
  if (processError && !error) setError(processError);

  if (telemetry != undefined) {
    console.log(telemetry[0].TrackName)
    console.log(telemetry[0].SessionNum)
  }

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold m-4">iRacing Telemetry Dashboard</h1>
        <SessionInfo searchParams={searchParams} pathname={pathname} router={router} sessionId={sessionId} lapId={lapId} />
      </div>

      {renderErrorMessage(error)}
      {renderLoadingMessage(telemetry, error)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-1 lg:col-span-2 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">
            test          </h2>

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

function SessionInfo({
  sessionId,
  lapId,
  router,
  pathname,
  searchParams
}: {
  sessionId: string;
  lapId: string | null;
  router: AppRouterInstance
  pathname: string,
  searchParams: ReadonlyURLSearchParams
}) {

  const { data, error } = useSWR(
    `/api/laps?sessionId=telemetry_${sessionId}`,
    fetcher
  );

  if (error !== undefined || lapId == null) {
    return <p>Error</p>
  }

  return (
    <div className="flex gap-2 m-4 text-gray-300 items-center">
      <p>Session: {sessionId}</p>
      <label className="mr-0">Lap:</label>
      <select
        value={lapId}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString())

          params.set("lapId", e.target.value);

          router.push(pathname + '?' + params.toString());
        }}
        className="bg-gray-700 text-white p-1 rounded"
      >
        {data?.laps.map((lap: string) => (
          <option key={lap} value={lap}>
            {lap}
          </option>
        ))}
      </select>
    </div>
  );
}

function renderErrorMessage(error: string | null) {
  if (!error) return null;

  return (
    <div className="bg-red-900 text-white m-4 rounded">
      <p className="font-semibold">Error</p>
      <p>{error}</p>
    </div>
  );
}

function renderLoadingMessage(telemetry: any, error: string | null) {
  if (telemetry !== undefined || error !== null) return null;

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
