"use client";

import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Stroke, Circle, Fill, Text } from "ol/style";
import { DragPan, MouseWheelZoom } from "ol/interaction";
import { defaults as defaultControls } from "ol/control";
import Projection from "ol/proj/Projection";
import { getCenter } from "ol/extent";
import Feature from "ol/Feature";
import { LineString, Point } from "ol/geom";
import ImageLayer from "ol/layer/Image";
import ImageStatic from "ol/source/ImageStatic";
import "ol/ol.css";
import { useMapLayers } from "@/hooks/useMapLayers";
import { TelemetryDataPoint } from "@/lib/types";

interface TrackMapProps {
  svgContainerRef: React.RefObject<HTMLDivElement | null>;
  dataWithCoordinates: TelemetryDataPoint[];
  selectedPointIndex: number;
  selectedLapPct: number;
  isScrubbing: boolean;
  getTrackDisplayPoint: () => TelemetryDataPoint | null;
}

export default function TrackMap({
  svgContainerRef,
  dataWithCoordinates,
  selectedPointIndex,
  isScrubbing,
  getTrackDisplayPoint,
}: TrackMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapInitialized, setMapInitialized] = useState<boolean>(false);
  const olMapRef = useRef<Map | null>(null);

  // Custom hook for map layers and sources
  const {
    racingLineSourceRef,
    carPositionSourceRef,
    selectedMarkerSourceRef,
    hoverMarkerSourceRef,
  } = useMapLayers();

  // Initialize OpenLayers map
  useEffect(() => {
    if (mapInitialized || !mapContainerRef.current) return;

    // Initialize map function
    const initializeMap = (): void => {
      // SVG dimensions
      const svgWidth = 1556;
      const svgHeight = 783;
      const extent = [0, 0, svgWidth, svgHeight];

      const projection = new Projection({
        code: "svg-pixels",
        units: "pixels",
        extent: extent,
      });

      // Create sources
      const racingLineSource = new VectorSource();
      racingLineSourceRef.current = racingLineSource;

      const carPositionSource = new VectorSource();
      carPositionSourceRef.current = carPositionSource;

      const hoverMarkerSource = new VectorSource();
      hoverMarkerSourceRef.current = hoverMarkerSource;

      const selectedMarkerSource = new VectorSource();
      selectedMarkerSourceRef.current = selectedMarkerSource;

      // Create layers
      const racingLineLayer = new VectorLayer({
        source: racingLineSource,
        style: new Style({
          stroke: new Stroke({
            color: "#f56565",
            width: 3,
          }),
        }),
      });

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

      const hoverMarkerLayer = new VectorLayer({
        source: hoverMarkerSource,
        style: new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({
              color: "#ffff00",
            }),
          }),
        }),
      });

      const selectedMarkerLayer = new VectorLayer({
        source: selectedMarkerSource,
        style: new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({
              color: "#00ffff",
            }),
            stroke: new Stroke({
              color: "#000000",
              width: 2,
            }),
          }),
        }),
        zIndex: 100,
      });

      // Create track image source
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
        layers: [
          trackLayer,
          racingLineLayer,
          carPositionLayer,
          hoverMarkerLayer,
          selectedMarkerLayer,
        ],
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

      olMapRef.current = map;
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
        selectedMarkerSourceRef.current = null;
        hoverMarkerSourceRef.current = null;
      }
    };
  }, [
    racingLineSourceRef,
    carPositionSourceRef,
    selectedMarkerSourceRef,
    hoverMarkerSourceRef,
  ]);

  // Update racing line and car position when data changes
  useEffect(() => {
    if (
      !mapInitialized ||
      !olMapRef.current ||
      !racingLineSourceRef.current ||
      !carPositionSourceRef.current ||
      dataWithCoordinates.length === 0
    ) {
      return;
    }

    racingLineSourceRef.current.clear();
    carPositionSourceRef.current.clear();

    try {
      // Add a special style for corner points to make the racing line more accurate
      const lineStyle = new Style({
        stroke: new Stroke({
          color: "#f56565",
          width: 3,
        }),
      });

      // Add different visual appearance for corners vs straights
      const cornerStyle = new Style({
        stroke: new Stroke({
          color: "#f56565",
          width: 4,
        }),
      });

      // Create the racing line
      const lineCoordinates = dataWithCoordinates
        .filter((point) => point.coordinates)
        .map((point) => point.coordinates as [number, number]);

      if (lineCoordinates.length > 0) {
        const lineFeature = new Feature({
          geometry: new LineString(lineCoordinates),
        });

        // Apply the default line style
        lineFeature.setStyle(lineStyle);
        racingLineSourceRef.current.addFeature(lineFeature);

        // Create separate features for corner segments for better visualization
        dataWithCoordinates.forEach((point, index) => {
          if (index > 0 && index < dataWithCoordinates.length - 1) {
            const prevPoint = dataWithCoordinates[index - 1];
            const cornerSegment = new Feature({
              geometry: new LineString([
                prevPoint.coordinates as [number, number],
                point.coordinates as [number, number],
              ]),
            });

            cornerSegment.setStyle(cornerStyle);
            racingLineSourceRef.current!.addFeature(cornerSegment);
          }
        });

        // Add the car feature at the start point
        const startPoints = dataWithCoordinates.filter((p) => p.LapDistPct < 1);
        const carPoint =
          startPoints.length > 0 ? startPoints[0] : dataWithCoordinates[0];

        if (carPoint.coordinates) {
          const carFeature = new Feature({
            geometry: new Point(carPoint.coordinates),
          });

          carFeature.setStyle(
            new Style({
              image: new Circle({
                radius: 8,
                fill: new Fill({
                  color: "#00ff00",
                }),
                stroke: new Stroke({
                  color: "#000000",
                  width: 2,
                }),
              }),
            })
          );

          carPositionSourceRef.current.addFeature(carFeature);
        }

        // Fit to the racing line bounds when not scrubbing
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
  }, [
    dataWithCoordinates,
    mapInitialized,
    isScrubbing,
    racingLineSourceRef,
    carPositionSourceRef,
  ]);

  useEffect(() => {
    if (!selectedMarkerSourceRef.current || dataWithCoordinates.length === 0) {
      return;
    }

    selectedMarkerSourceRef.current.clear();

    const validIndex = Math.min(
      Math.max(0, selectedPointIndex),
      dataWithCoordinates.length - 1
    );

    const selectedPoint = dataWithCoordinates[validIndex] as TelemetryDataPoint;

    if (!selectedPoint) return;

    const lapDistPct = selectedPoint.LapDistPct;

    const similarPoints = dataWithCoordinates.filter(
      (p) => Math.abs(p.LapDistPct - lapDistPct) < 1.0
    ) as TelemetryDataPoint[];

    let pointToDisplay = selectedPoint;

    if (similarPoints.length > 0) {
      if (selectedPoint.Speed < 40) {
        pointToDisplay = similarPoints.reduce(
          (lowest, current) =>
            current.Speed < lowest.Speed ? current : lowest,
          similarPoints[0]
        );
      } else {
        pointToDisplay = similarPoints.reduce(
          (closest, current) =>
            Math.abs(current.LapDistPct - lapDistPct) <
              Math.abs(closest.LapDistPct - lapDistPct)
              ? current
              : closest,
          similarPoints[0]
        );
      }
    }

    if (pointToDisplay && pointToDisplay.coordinates) {
      const markerFeature = new Feature({
        geometry: new Point(pointToDisplay.coordinates),
      });

      let displayText = `${pointToDisplay.LapDistPct.toFixed(1)}% - ${pointToDisplay.Speed.toFixed(1)}kph`;

      if (Math.abs(pointToDisplay.LapDistPct) < 0.5 ||
        Math.abs(pointToDisplay.LapDistPct - 100) < 0.5) {
        displayText = `Start/Finish - ${pointToDisplay.Speed.toFixed(1)}kph`;
      }

      markerFeature.setStyle(
        new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({
              color: "#00ffff",
            }),
            stroke: new Stroke({
              color: "#000000",
              width: 2,
            }),
          }),
          text: new Text({
            text: displayText,
            offsetY: -15,
            font: "12px sans-serif",
            fill: new Fill({
              color: "#ffffff",
            }),
            stroke: new Stroke({
              color: "#000000",
              width: 2,
            }),
          }),
        })
      );

      selectedMarkerSourceRef.current.addFeature(markerFeature);

      if (isScrubbing && olMapRef.current) {
        olMapRef.current.getView().animate({
          center: pointToDisplay.coordinates,
          duration: 340,
        });
      }
    }
  }, [selectedPointIndex, dataWithCoordinates, isScrubbing, selectedMarkerSourceRef]);

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
    <div className="h-[500px] bg-gray-800 rounded-lg relative">
      {/* Zoom Controls */}
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
      />

      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
