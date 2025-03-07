import { useState, useRef, useEffect } from "react";

export function useSvgTrack() {
  const [trackPath, setTrackPath] = useState<SVGPathElement | null>(null);
  const [startFinishPosition, setStartFinishPosition] = useState<number>(0);
  const [svgLoaded, setSvgLoaded] = useState<boolean>(false);
  const [svgError, setSvgError] = useState<string | null>(null);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);

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

          // Find the start/finish line position
          const startFinishPoint = svgDoc.getElementById(
            "start-finish-line"
          ) as SVGCircleElement | null;

          if (startFinishPoint) {
            const startX = parseFloat(
              startFinishPoint.getAttribute("x1") || "1115"
            );
            const startY = parseFloat(
              startFinishPoint.getAttribute("y1") || "768"
            );

            // Find the closest point on the track path using binary search for better precision
            const pathLength = pathElement.getTotalLength();
            let closestPoint = 0;
            let minDistance = Number.MAX_VALUE;

            // First pass with fewer samples to get approximate location
            let step = pathLength / 100;
            for (let i = 0; i < pathLength; i += step) {
              const point = pathElement.getPointAtLength(i);
              const distance = Math.sqrt(
                Math.pow(point.x - startX, 2) + Math.pow(point.y - startY, 2)
              );

              if (distance < minDistance) {
                minDistance = distance;
                closestPoint = i;
              }
            }

            // Second pass with higher precision around the approximate location
            const searchRange = Math.min(pathLength / 20, 100); // Limit search range
            const minSearch = Math.max(0, closestPoint - searchRange);
            const maxSearch = Math.min(pathLength, closestPoint + searchRange);

            // Much finer step for the second pass
            step = (maxSearch - minSearch) / 1000;
            for (let i = minSearch; i <= maxSearch; i += step) {
              const point = pathElement.getPointAtLength(i);
              const distance = Math.sqrt(
                Math.pow(point.x - startX, 2) + Math.pow(point.y - startY, 2)
              );

              if (distance < minDistance) {
                minDistance = distance;
                closestPoint = i;
              }
            }

            setStartFinishPosition(closestPoint);
            console.log(
              `Start/finish position found at ${closestPoint}/${pathLength} (${(
                (closestPoint / pathLength) *
                100
              ).toFixed(2)}%)`
            );
          }
        } else {
          throw new Error("Track path not found in SVG");
        }
      } catch (error) {
        console.error("Error loading SVG:", error);
        setSvgError("Failed to load track. Please refresh and try again.");
      }
    };

    loadSvg();
  }, [svgLoaded]);

  return {
    trackPath,
    startFinishPosition,
    svgLoaded,
    svgContainerRef,
    svgError,
  };
}
