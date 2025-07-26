import { type RefObject, useEffect, useMemo, useState } from "react";
import { TelemetryDataPoint } from "@/lib/types";

export function useTelemetryData(
	telemetry: any[] | undefined,
	trackPath: SVGPathElement | null,
	startFinishPosition: number,
	svgContainerRef: RefObject<HTMLDivElement | null>,
	isClockwise = 0,
) {
	const [processError, setProcessError] = useState<string | null>(null);

	const dataWithCoordinates = useMemo(() => {
		if (!telemetry?.length || !trackPath || !svgContainerRef.current) {
			return [];
		}

		try {
			const pathElement = svgContainerRef.current.querySelector(
				"#track-outline",
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

			return telemetry.map((point, index) => {
				const adjustedLapPct = (point.LapDistPct / 100) % 1.0;

				let pathPosition;

				if (isClockwise) {
					pathPosition =
						(startFinishPosition + adjustedLapPct * totalLength) % totalLength;
				} else {
					pathPosition =
						(startFinishPosition - adjustedLapPct * totalLength + totalLength) %
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

					if (brakeFactor > 0.3) {
						offsetMagnitude *= 1 - brakeFactor * 0.7;
					}

					if (throttleFactor > 0.7 && Math.abs(steeringFactor) > 0.2) {
						offsetMagnitude *= 1 + throttleFactor * 0.8;
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
					const speedAdjustment = 0.8 + 0.5 * speedFactor;

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
					pathPosition,
					originalIndex: index,
					speed: point.Speed,
				};
			});
		} catch (error) {
			console.error("Error calculating coordinates:", error);
			setProcessError("Error processing telemetry data with track path.");
			return [];
		}
	}, [telemetry, trackPath, startFinishPosition, svgContainerRef, isClockwise]);

	return {
		dataWithCoordinates,
		processError,
	};
}
