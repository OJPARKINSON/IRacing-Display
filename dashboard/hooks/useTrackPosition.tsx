import { useCallback, useState } from "react";
import type { TelemetryDataPoint } from "@/lib/types";

/**
 * Custom hook to manage track position synchronization with chart
 */
export function useTrackPosition(telemetryData: TelemetryDataPoint[]) {
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [selectedLapPct, setSelectedLapPct] = useState<number>(0);

	/**
	 * Find the best point on the track corresponding to a specific chart index
	 * Uses a combination of methods to ensure accuracy
	 */
	const handlePointSelection = useCallback(
		(index: number) => {
			if (
				!telemetryData ||
				telemetryData.length === 0 ||
				index < 0 ||
				index >= telemetryData.length
			) {
				return;
			}

			const clickedPoint = telemetryData[index];
			setSelectedIndex(index);

			setSelectedLapPct(clickedPoint.LapDistPct);
		},
		[telemetryData],
	);

	/**
	 * Find the exact point on the track for display
	 * This ensures the marker appears at precisely the right place
	 */
	const getTrackDisplayPoint = useCallback(() => {
		if (!telemetryData || telemetryData.length === 0) {
			return null;
		}

		// Find the point closest to the selected lap percentage
		let bestPoint = null;
		let minDistance = 100; // Maximum possible distance is 100%

		for (const point of telemetryData) {
			const distance = Math.abs(point.LapDistPct - selectedLapPct);
			// Handle wrap-around case (e.g., 99% vs 1%)
			const wrappedDistance = Math.min(distance, 100 - distance);

			if (wrappedDistance < minDistance) {
				minDistance = wrappedDistance;
				bestPoint = point;
			}
		}

		return bestPoint;
	}, [telemetryData, selectedLapPct]);

	return {
		selectedIndex,
		selectedLapPct,
		handlePointSelection,
		getTrackDisplayPoint,
	};
}
