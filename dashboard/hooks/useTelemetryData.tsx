import { useState, useEffect, useMemo, RefObject } from "react";

export function useTelemetryData(
  telemetry: any[] | undefined,
  trackPath: SVGPathElement | null,
  startFinishPosition: number,
  svgContainerRef: RefObject<HTMLDivElement>,
  isClockwise: number = 0 // 0 for counterclockwise (default), 1 for clockwise
) {
  const [processError, setProcessError] = useState<string | null>(null);

  const dataWithCoordinates = useMemo(() => {
    if (!telemetry?.length || !trackPath || !svgContainerRef.current) {
      return [];
    }

    try {
      const pathElement = svgContainerRef.current.querySelector(
        "#track-outline"
      ) as SVGPathElement;
      if (!pathElement) return [];

      const totalLength = pathElement.getTotalLength();

      const rotationAngle = 90;
      const insideTrackFactor = 0.8;
      const verticalOffset = -0;
      const horizontalOffset = 780;

      const minSpeed = Math.min(...telemetry.map((p) => p.Speed));
      const maxSpeed = Math.max(...telemetry.map((p) => p.Speed));
      const speedRange = maxSpeed - minSpeed;

      return telemetry
        .map((point) => {
          // Adjust and normalize LapDistPct to ensure consistency
          const adjustedLapPct = (point.LapDistPct / 100) % 1.0; // Ensure 0-1 range

          // More accurate path position calculation
          let pathPosition;
          if (isClockwise) {
            // For clockwise tracks, we move backward from start position
            pathPosition =
              ((1 - adjustedLapPct) * totalLength + startFinishPosition) %
              totalLength;
          } else {
            // For counterclockwise tracks, we move forward from start position
            pathPosition =
              (adjustedLapPct * totalLength + startFinishPosition) %
              totalLength;
          }

          const basePoint = pathElement.getPointAtLength(pathPosition);

          let offsetX = 0;
          let offsetY = 0;

          const steeringFactor = point.SteeringWheelAngle / 10;

          if (Math.abs(steeringFactor) > 0.01) {
            const stepSize = totalLength / 1;
            const prevPosition = Math.max(0, pathPosition - stepSize);
            const nextPosition = Math.min(totalLength, pathPosition + stepSize);

            const prevPoint = pathElement.getPointAtLength(prevPosition);
            const nextPoint = pathElement.getPointAtLength(nextPosition);

            const dirX = nextPoint.x - prevPoint.x;
            const dirY = nextPoint.y - prevPoint.y;
            const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
            const normDirX = dirLength > 0 ? dirX / dirLength : 0;
            const normDirY = dirLength > 0 ? dirY / dirLength : 0;

            const perpDirX = -normDirY;
            const perpDirY = normDirX;

            const speedFactor = point.Speed / 250;
            const throttleFactor = point.Throttle / 100;
            const brakeFactor = point.Brake / 100;

            let offsetMagnitude = Math.min(18, Math.abs(steeringFactor * 12));

            offsetMagnitude *= 1 + speedFactor * 0.5;

            // Adjust racing line for corners to be more accurate
            if (brakeFactor > 0.3) {
              offsetMagnitude *= 1 - brakeFactor * 0.7; // Reduce racingLine offset when braking
            }

            if (throttleFactor > 0.7 && Math.abs(steeringFactor) > 0.2) {
              offsetMagnitude *= 1 + throttleFactor * 0.8; // Increase racingLine offset when accelerating out of corners
            }

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

          if (speedRange > 0) {
            const speedFactor = (point.Speed - minSpeed) / speedRange;
            // Make line position more accurate by having it follow a tighter inside line in slow corners
            const speedAdjustment = 0.8 + 0.5 * speedFactor; // Tighter line at slow speeds (corners)

            offsetX *= speedAdjustment;
            offsetY *= speedAdjustment;
          }

          const radians = (rotationAngle * Math.PI) / 180;
          const rotatedX =
            (basePoint.x + offsetX) * Math.cos(radians) -
            (basePoint.y + offsetY) * Math.sin(radians);
          const rotatedY =
            (basePoint.x + offsetX) * Math.sin(radians) +
            (basePoint.y + offsetY) * Math.cos(radians);

          const finalX = rotatedX + horizontalOffset;
          const finalY = rotatedY + verticalOffset;

          return {
            ...point,
            coordinates: [finalY, finalX] as [number, number],
            pathPosition, // Store path position for debugging
            originalIndex: point.originalIndex, // Keep the original index
            speed: point.Speed, // Store speed explicitly for debugging
          };
        })
        .sort((a, b) => a.originalIndex - b.originalIndex);
    } catch (error) {
      console.error("Error calculating coordinates:", error);
      setProcessError("Error processing telemetry data with track path.");
      return [];
    }
  }, [telemetry, trackPath, startFinishPosition, svgContainerRef]);

  return {
    dataWithCoordinates,
    processError,
  };
}
