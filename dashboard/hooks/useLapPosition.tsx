import { useRef } from "react";
import { TelemetryDataPoint } from "@/lib/types";

export function useLapPosition(
  telemetryData: TelemetryDataPoint[],
  targetLapDistPct?: number
) {
  const lastFoundIndex = useRef<number>(0);

  /**
   * Finds the index of the telemetry point closest to the given lap distance percentage
   */
  const findPointByLapDistPct = (lapDistPct: number): number => {
    if (!telemetryData || telemetryData.length === 0) return 0;

    // Normalize the lap distance percentage to 0-100 range
    const normalizedPct = lapDistPct % 100;

    // Start search from last found index for optimization
    let startIdx = lastFoundIndex.current;
    if (startIdx >= telemetryData.length) startIdx = 0;

    // First check if we can find an exact match
    for (let i = 0; i < telemetryData.length; i++) {
      const idx = (startIdx + i) % telemetryData.length;
      if (Math.abs(telemetryData[idx].LapDistPct - normalizedPct) < 0.1) {
        lastFoundIndex.current = idx;
        return idx;
      }
    }

    // If no exact match, find closest point
    let closestIdx = 0;
    let minDiff = 100; // Maximum difference possible is 100

    for (let i = 0; i < telemetryData.length; i++) {
      const diff = Math.abs(telemetryData[i].LapDistPct - normalizedPct);
      // Handle wrap-around case (near 0/100 boundary)
      const wrapDiff = Math.min(diff, 100 - diff);

      if (wrapDiff < minDiff) {
        minDiff = wrapDiff;
        closestIdx = i;
      }
    }

    lastFoundIndex.current = closestIdx;
    return closestIdx;
  };

  /**
   * Find the two points that surround the given lap distance percentage
   * and interpolate between them for smoother positioning
   */
  const interpolatePosition = (lapDistPct: number) => {
    if (!telemetryData || telemetryData.length < 2) {
      return { index: 0, point: telemetryData?.[0] };
    }

    // Find the closest points before and after the target lap distance
    const normalizedPct = lapDistPct % 100;
    let beforeIdx = -1;
    let afterIdx = -1;

    // Handle the wrap-around case at 0/100 boundary
    const sortedPoints = [...telemetryData].sort(
      (a, b) => a.LapDistPct - b.LapDistPct
    );

    for (let i = 0; i < sortedPoints.length; i++) {
      if (sortedPoints[i].LapDistPct <= normalizedPct) {
        beforeIdx = i;
      } else {
        afterIdx = i;
        break;
      }
    }

    // Handle wrap-around cases
    if (beforeIdx === -1) {
      beforeIdx = sortedPoints.length - 1; // Wrap to end of array
    }

    if (afterIdx === -1) {
      afterIdx = 0; // Wrap to beginning of array
    }

    const beforePoint = sortedPoints[beforeIdx];
    const afterPoint = sortedPoints[afterIdx];

    // Calculate interpolation factor
    let t = 0;
    if (afterPoint.LapDistPct > beforePoint.LapDistPct) {
      t =
        (normalizedPct - beforePoint.LapDistPct) /
        (afterPoint.LapDistPct - beforePoint.LapDistPct);
    } else {
      // Handle wrap around 0/100 boundary
      const wrappedPct =
        normalizedPct < beforePoint.LapDistPct
          ? normalizedPct + 100
          : normalizedPct;
      t =
        (wrappedPct - beforePoint.LapDistPct) /
        (afterPoint.LapDistPct + 100 - beforePoint.LapDistPct);
    }

    t = Math.max(0, Math.min(1, t)); // Clamp to 0-1 range

    // Find the actual indices in the original array
    const originalBeforeIdx = telemetryData.findIndex(
      (p) =>
        p.LapDistPct === beforePoint.LapDistPct &&
        p.sessionTime === beforePoint.sessionTime
    );

    const originalAfterIdx = telemetryData.findIndex(
      (p) =>
        p.LapDistPct === afterPoint.LapDistPct &&
        p.sessionTime === afterPoint.sessionTime
    );

    return {
      beforeIndex: originalBeforeIdx,
      afterIndex: originalAfterIdx,
      interpolationFactor: t,
      // Return the closest point for simplicity
      index: t < 0.5 ? originalBeforeIdx : originalAfterIdx,
    };
  };

  return {
    findPointByLapDistPct,
    interpolatePosition,
  };
}
