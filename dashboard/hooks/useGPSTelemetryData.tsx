import { useState, useEffect, useMemo, RefObject } from "react";
import { TelemetryDataPoint } from "@/lib/types";

export function useGPSTelemetryData(
    telemetry: any[] | undefined,
    trackName?: string
) {
    const [processError, setProcessError] = useState<string | null>(null);
    const [trackBounds, setTrackBounds] = useState<{
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    } | null>(null);

    const dataWithGPSCoordinates = useMemo(() => {
        if (!telemetry?.length) {
            return [];
        }

        try {
            // Filter out points with invalid GPS coordinates
            const validGPSData = telemetry.filter(point =>
                point.Lat &&
                point.Lon &&
                point.Lat !== 0 &&
                point.Lon !== 0 &&
                Math.abs(point.Lat) <= 90 &&
                Math.abs(point.Lon) <= 180
            );

            if (validGPSData.length === 0) {
                setProcessError("No valid GPS coordinates found in telemetry data");
                return [];
            }

            // Calculate track bounds
            const lats = validGPSData.map(p => p.Lat);
            const lons = validGPSData.map(p => p.Lon);

            const bounds = {
                minLat: Math.min(...lats),
                maxLat: Math.max(...lats),
                minLon: Math.min(...lons),
                maxLon: Math.max(...lons),
            };

            setTrackBounds(bounds);

            // Process and enhance the telemetry data
            const processedData = validGPSData.map((point, index) => {
                // Calculate distance from previous point
                let distanceFromPrev = 0;
                if (index > 0) {
                    const prevPoint = validGPSData[index - 1];
                    distanceFromPrev = calculateGPSDistance(
                        prevPoint.Lat, prevPoint.Lon,
                        point.Lat, point.Lon
                    );
                }

                // Calculate speed from GPS if velocity data is missing
                let calculatedSpeed = point.Speed;
                if (!calculatedSpeed && index > 0 && point.session_time && validGPSData[index - 1].session_time) {
                    const timeDiff = point.session_time - validGPSData[index - 1].session_time;
                    if (timeDiff > 0) {
                        calculatedSpeed = (distanceFromPrev / timeDiff) * 3.6; // Convert m/s to km/h
                    }
                }

                // Calculate heading/bearing if velocity data is missing
                let heading = 0;
                if (index > 0) {
                    const prevPoint = validGPSData[index - 1];
                    heading = calculateBearing(
                        prevPoint.Lat, prevPoint.Lon,
                        point.Lat, point.Lon
                    );
                }

                return {
                    ...point,
                    calculatedSpeed,
                    heading,
                    distanceFromPrev,
                    gpsValid: true,
                    originalIndex: index,
                };
            });

            // Smooth the data to remove GPS noise
            const smoothedData = smoothGPSData(processedData);

            // Detect corners and straights based on GPS data
            const dataWithSections = detectTrackSections(smoothedData);

            return dataWithSections;

        } catch (error) {
            console.error("Error processing GPS telemetry data:", error);
            setProcessError("Error processing GPS telemetry data.");
            return [];
        }
    }, [telemetry]);

    return {
        dataWithGPSCoordinates: dataWithGPSCoordinates,
        trackBounds,
        processError,
    };
}

// Calculate distance between two GPS points using Haversine formula
function calculateGPSDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate bearing between two GPS points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
}

// Smooth GPS data to reduce noise
function smoothGPSData(data: any[]): any[] {
    const windowSize = 5; // Number of points to average

    return data.map((point, index) => {
        const start = Math.max(0, index - Math.floor(windowSize / 2));
        const end = Math.min(data.length, index + Math.floor(windowSize / 2) + 1);

        const window = data.slice(start, end);

        // Smooth latitude and longitude
        const avgLat = window.reduce((sum, p) => sum + p.Lat, 0) / window.length;
        const avgLon = window.reduce((sum, p) => sum + p.Lon, 0) / window.length;

        // Smooth speed if available
        const speeds = window.filter(p => p.Speed).map(p => p.Speed);
        const avgSpeed = speeds.length > 0 ? speeds.reduce((sum, s) => sum + s, 0) / speeds.length : point.Speed;

        return {
            ...point,
            Lat: index < 2 || index > data.length - 3 ? point.Lat : avgLat, // Don't smooth start/end points
            Lon: index < 2 || index > data.length - 3 ? point.Lon : avgLon,
            Speed: avgSpeed,
        };
    });
}

// Detect corners and straights based on GPS data
function detectTrackSections(data: any[]): any[] {
    return data.map((point, index) => {
        let sectionType = 'straight';
        let turnRadius = 0;

        if (index >= 2 && index < data.length - 2) {
            // Calculate change in heading over a small window
            const prevHeading = data[index - 2].heading;
            const nextHeading = data[index + 2].heading;

            let headingChange = Math.abs(nextHeading - prevHeading);
            if (headingChange > 180) {
                headingChange = 360 - headingChange; // Handle wraparound
            }

            // Classify based on heading change and speed
            if (headingChange > 15) { // Significant direction change
                sectionType = 'corner';

                // Estimate turn radius based on speed and heading change
                const avgSpeed = point.Speed || 0;
                if (avgSpeed > 0 && headingChange > 0) {
                    const timeWindow = 4; // Assume 4 data points = some time interval
                    turnRadius = (avgSpeed * timeWindow) / (headingChange * Math.PI / 180);
                }
            } else if (headingChange > 5) {
                sectionType = 'gentle_turn';
            }
        }

        return {
            ...point,
            sectionType,
            turnRadius,
        };
    });
}

// Helper function to get track boundaries from OpenStreetMap
export async function fetchTrackBoundaries(trackName: string, bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}) {
    try {
        // Overpass API query to get track boundaries
        const overpassQuery = `
      [out:json][timeout:25];
      [bbox:${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}];
      (
        way["sport"="motor"];
        way["motorsport"="yes"];
        way["highway"="raceway"];
        way["leisure"="track"]["sport"="motor"];
        relation["sport"="motor"];
      );
      out geom;
    `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery,
        });

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Process the track boundary data
        const trackFeatures = data.elements
            .filter((element: any) => element.type === 'way' && element.geometry)
            .map((element: any) => ({
                id: element.id,
                tags: element.tags,
                coordinates: element.geometry.map((node: any) => [node.lon, node.lat]),
            }));

        return trackFeatures;

    } catch (error) {
        console.error('Error fetching track boundaries from OpenStreetMap:', error);
        return [];
    }
}

// Alternative: Create approximate track boundaries from telemetry
export function createApproximateTrackBoundaries(
    telemetryData: TelemetryDataPoint[],
    trackWidth: number = 15 // meters
): { outer: [number, number][], inner: [number, number][] } {
    const outer: [number, number][] = [];
    const inner: [number, number][] = [];

    for (let i = 0; i < telemetryData.length; i++) {
        const point = telemetryData[i];
        const nextPoint = telemetryData[(i + 1) % telemetryData.length];

        // Calculate perpendicular direction
        const bearing = calculateBearing(point.Lat, point.Lon, nextPoint.Lat, nextPoint.Lon);
        const perpBearing1 = (bearing + 90) % 360;
        const perpBearing2 = (bearing - 90) % 360;

        // Calculate outer and inner boundary points
        const outerPoint = calculateDestinationPoint(point.Lat, point.Lon, perpBearing1, trackWidth / 2);
        const innerPoint = calculateDestinationPoint(point.Lat, point.Lon, perpBearing2, trackWidth / 2);

        outer.push([outerPoint.lon, outerPoint.lat]);
        inner.push([innerPoint.lon, innerPoint.lat]);
    }

    return { outer, inner };
}

// Calculate destination point given start point, bearing, and distance
function calculateDestinationPoint(lat: number, lon: number, bearing: number, distance: number) {
    const R = 6371000; // Earth's radius in meters
    const bearingRad = bearing * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;

    const newLatRad = Math.asin(
        Math.sin(latRad) * Math.cos(distance / R) +
        Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );

    const newLonRad = lonRad + Math.atan2(
        Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
        Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad)
    );

    return {
        lat: newLatRad * 180 / Math.PI,
        lon: newLonRad * 180 / Math.PI,
    };
}