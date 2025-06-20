import { useRef } from "react";
import VectorSource from "ol/source/Vector";

export function useMapLayers() {
	const racingLineSourceRef = useRef<VectorSource | null>(null);
	const carPositionSourceRef = useRef<VectorSource | null>(null);
	const selectedMarkerSourceRef = useRef<VectorSource | null>(null);
	const hoverMarkerSourceRef = useRef<VectorSource | null>(null);

	return {
		racingLineSourceRef,
		carPositionSourceRef,
		selectedMarkerSourceRef,
		hoverMarkerSourceRef,
	};
}
