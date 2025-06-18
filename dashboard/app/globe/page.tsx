"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Target, Activity, MapPin, Clock, Gauge, Navigation, LucideIcon } from 'lucide-react';
import Globe from 'react-globe.gl';

// Type definitions
interface Track {
    track_id: number;
    track_name: string;
    location: string;
    latitude: number;
    longitude: number;
    track_config_length: number;
    corners_per_lap: number;
    category: TrackCategory;
    track_type_text: string;
    sessions: number;
    lastSession: string;
    bestLap: string;
}

interface TrackPoint extends Track {
    lat: number;
    lng: number;
    size: number;
    color: string;
}

type TrackCategory = 'road' | 'oval' | 'dirt' | 'street';

interface GeoJSONFeature {
    type: 'Feature';
    properties: {
        [key: string]: any;
    };
    geometry: {
        type: string;
        coordinates: number[][][] | number[][][][] | number[];
    };
}

interface CountriesData {
    features: GeoJSONFeature[];
}

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    color?: string;
}

interface TrackPopupProps {
    track: Track | null;
    onClose: () => void;
}

// Your track data
const mockTracks: Track[] = [
    {
        track_id: 1,
        track_name: "Virginia International Raceway",
        location: "Alton, Virginia, USA",
        latitude: 36.560008,
        longitude: -79.2048,
        track_config_length: 4.07,
        corners_per_lap: 26,
        category: "road",
        track_type_text: "Road Course",
        sessions: 12,
        lastSession: "2024-01-15",
        bestLap: "1:42.567"
    },
    {
        track_id: 2,
        track_name: "Autodromo Nazionale Monza",
        location: "Monza, Italy",
        latitude: 45.6156,
        longitude: 9.2811,
        track_config_length: 5.793,
        corners_per_lap: 11,
        category: "road",
        track_type_text: "Road Course",
        sessions: 8,
        lastSession: "2024-01-10",
        bestLap: "1:21.046"
    },
    {
        track_id: 3,
        track_name: "Circuit de Spa-Francorchamps",
        location: "Stavelot, Belgium",
        latitude: 50.4372,
        longitude: 5.9714,
        track_config_length: 7.004,
        corners_per_lap: 19,
        category: "road",
        track_type_text: "Road Course",
        sessions: 15,
        lastSession: "2024-01-20",
        bestLap: "2:17.720"
    },
    {
        track_id: 4,
        track_name: "Nürburgring Grand Prix",
        location: "Nürburg, Germany",
        latitude: 50.3356,
        longitude: 6.9475,
        track_config_length: 5.148,
        corners_per_lap: 15,
        category: "road",
        track_type_text: "Road Course",
        sessions: 6,
        lastSession: "2023-12-28",
        bestLap: "1:35.234"
    },
    {
        track_id: 5,
        track_name: "Suzuka International Racing Course",
        location: "Suzuka, Japan",
        latitude: 34.8431,
        longitude: 136.5407,
        track_config_length: 5.807,
        corners_per_lap: 18,
        category: "road",
        track_type_text: "Road Course",
        sessions: 9,
        lastSession: "2024-01-05",
        bestLap: "1:32.983"
    },
    {
        track_id: 6,
        track_name: "Daytona International Speedway",
        location: "Daytona Beach, Florida, USA",
        latitude: 29.1869,
        longitude: -81.0715,
        track_config_length: 4.023,
        corners_per_lap: 4,
        category: "oval",
        track_type_text: "Superspeedway",
        sessions: 22,
        lastSession: "2024-01-22",
        bestLap: "0:46.221"
    }
];

// Get country data for polygons
const getCountriesData = async (): Promise<CountriesData> => {
    try {
        const response = await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading countries:', error);
        return { features: [] };
    }
};

const getTrackTypeColor = (category: TrackCategory): string => {
    const colors: Record<TrackCategory, string> = {
        'road': '#f59e0b',
        'oval': '#ef4444',
        'dirt': '#a78bfa',
        'street': '#10b981'
    };
    return colors[category] || '#6b7280';
};

const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const generateTooltipContent = (point: TrackPoint): string => {
    return `
        <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid #374151; border-radius: 8px; padding: 12px; color: white; font-family: monospace; max-width: 250px;">
            <div style="color: #f59e0b; font-weight: bold; margin-bottom: 8px;">${point.track_name}</div>
            <div style="color: #9ca3af; margin-bottom: 8px; font-size: 12px;">${point.location}</div>
            <div style="margin-bottom: 4px;"><span style="color: #6b7280;">Length:</span> <span style="color: #f59e0b;">${point.track_config_length}km</span></div>
            <div style="margin-bottom: 4px;"><span style="color: #6b7280;">Sessions:</span> <span style="color: #10b981;">${point.sessions}</span></div>
            <div><span style="color: #6b7280;">Best Lap:</span> <span style="color: #ef4444;">${point.bestLap}</span></div>
        </div>
    `;
};

const StatCard: React.FC<StatCardProps> = ({
    icon: Icon,
    label,
    value,
    color = "text-amber-400"
}) => (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-xs text-gray-400 font-mono uppercase tracking-wide">{label}</span>
        </div>
        <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
);

const TrackPopup: React.FC<TrackPopupProps> = ({ track, onClose }) => {
    if (!track) return null;

    return (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900 border border-gray-700 rounded-lg p-4 min-w-[280px] shadow-2xl">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="text-lg font-bold text-amber-400 mb-1 font-mono">
                        {track.track_name}
                    </h3>
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {track.location}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors text-xl"
                    aria-label="Close popup"
                >
                    ×
                </button>
            </div>

            <div
                className="inline-block px-2 py-1 rounded text-xs font-mono uppercase tracking-wide border mb-3"
                style={{
                    backgroundColor: `${getTrackTypeColor(track.category)}20`,
                    borderColor: getTrackTypeColor(track.category),
                    color: getTrackTypeColor(track.category)
                }}
            >
                {track.track_type_text}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-gray-800/60 rounded p-2">
                    <div className="text-xs text-gray-400 font-mono mb-1">LENGTH</div>
                    <div className="text-amber-400 font-bold font-mono">{track.track_config_length}km</div>
                </div>
                <div className="bg-gray-800/60 rounded p-2">
                    <div className="text-xs text-gray-400 font-mono mb-1">CORNERS</div>
                    <div className="text-amber-400 font-bold font-mono">{track.corners_per_lap}</div>
                </div>
                <div className="bg-gray-800/60 rounded p-2">
                    <div className="text-xs text-gray-400 font-mono mb-1">SESSIONS</div>
                    <div className="text-green-400 font-bold font-mono">{track.sessions}</div>
                </div>
                <div className="bg-gray-800/60 rounded p-2">
                    <div className="text-xs text-gray-400 font-mono mb-1">BEST LAP</div>
                    <div className="text-red-400 font-bold font-mono">{track.bestLap}</div>
                </div>
            </div>

            <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-gray-400 font-mono">Last Session:</span>
                <span className="text-white font-mono">{formatDate(track.lastSession)}</span>
            </div>

            <button className="w-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500 text-amber-400 py-2 px-4 rounded font-mono text-sm transition-colors">
                VIEW TELEMETRY
            </button>
        </div>
    );
};

const SpyDashboardGlobe: React.FC = () => {
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [countriesData, setCountriesData] = useState<CountriesData>({ features: [] });
    const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
    const [userInteracted, setUserInteracted] = useState<boolean>(false);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
    const globeRef = useRef<any>(null);
    const autoRotateRef = useRef<NodeJS.Timeout | null>(null);
    const lastInteractionRef = useRef<number>(0);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Handle window resize and set initial dimensions
    useEffect(() => {
        const updateDimensions = () => {
            if (typeof window !== 'undefined') {
                setDimensions({
                    width: window.innerWidth,
                    height: window.innerHeight - 80
                });
            }
        };

        // Set initial dimensions
        updateDimensions();

        // Add resize listener
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateDimensions);
            return () => window.removeEventListener('resize', updateDimensions);
        }
    }, []);

    // Load countries data
    useEffect(() => {
        getCountriesData().then(setCountriesData);
    }, []);

    // Format tracks for react-globe.gl
    const trackPoints: TrackPoint[] = mockTracks.map(track => ({
        ...track,
        lat: track.latitude,
        lng: track.longitude,
        size: Math.min(Math.max(track.sessions * 0.3, 1), 5),
        color: getTrackTypeColor(track.category)
    }));

    const totalSessions = mockTracks.reduce((sum, track) => sum + track.sessions, 0);
    const totalTracks = mockTracks.length;
    const totalDistance = mockTracks.reduce((sum, track) => sum + track.track_config_length, 0);

    // Auto-rotation with user interaction detection
    useEffect(() => {
        if (!globeRef.current) return;

        const globe = globeRef.current;
        let angle = 0;

        const autoRotate = (): void => {
            const now = Date.now();
            // Only auto-rotate if user hasn't interacted recently (within 5 seconds)
            if (isAutoRotating && (now - lastInteractionRef.current > 5000)) {
                angle += 0.2;
                globe.pointOfView({
                    lat: 0,
                    lng: angle,
                    altitude: 2.5
                }, 0); // No transition duration for smooth rotation
            }
        };

        if (isAutoRotating) {
            autoRotateRef.current = setInterval(autoRotate, 50);
        }

        return () => {
            if (autoRotateRef.current) {
                clearInterval(autoRotateRef.current);
                autoRotateRef.current = null;
            }
        };
    }, [isAutoRotating]);

    // Handle user interactions
    const handleGlobeInteraction = (): void => {
        lastInteractionRef.current = Date.now();
        if (!userInteracted) {
            setUserInteracted(true);
        }
    };

    const toggleAutoRotation = (): void => {
        setIsAutoRotating(!isAutoRotating);
    };

    const handleTrackClick = (point: any): void => {
        // Stop auto-rotation when user clicks on a track
        lastInteractionRef.current = Date.now();
        setSelectedTrack(point as Track);
    };

    const handleClosePopup = (): void => {
        setSelectedTrack(null);
    };

    return (
        <div className="h-screen bg-gray-900 text-white overflow-hidden relative">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-50 bg-gray-900/90 backdrop-blur-sm border-b border-gray-700/50">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                        <Target className="w-8 h-8 text-amber-400" />
                        <div>
                            <h1 className="text-xl font-bold font-mono text-amber-400">TELEMETRY COMMAND</h1>
                            <p className="text-sm text-gray-400 font-mono">Global Track Operations</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-sm text-gray-400 font-mono">MISSION TIME</div>
                            <div className="text-amber-400 font-mono font-bold">
                                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-400 font-mono">ONLINE</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Stats Sidebar */}
            <aside className="absolute top-20 left-4 z-40 w-64 space-y-3">
                <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4">
                    <h2 className="text-lg font-bold text-amber-400 mb-3 font-mono">OPERATIONS STATUS</h2>
                    <div className="space-y-3">
                        <StatCard icon={Activity} label="Active Tracks" value={totalTracks} color="text-green-400" />
                        <StatCard icon={Navigation} label="Total Sessions" value={totalSessions} color="text-blue-400" />
                        <StatCard icon={Gauge} label="Distance (km)" value={totalDistance.toFixed(1)} color="text-purple-400" />
                        <StatCard icon={Clock} label="Last Update" value="Real-time" color="text-amber-400" />
                    </div>
                </div>

                {/* Legend */}
                <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-amber-400 mb-2 font-mono">TRACK CLASSIFICATION</h3>
                    <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                            <span>Road Course</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span>Oval/Speedway</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                            <span>Dirt Track</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>Street Circuit</span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-amber-400 mb-2 font-mono">CONTROLS</h3>
                    <div className="space-y-2">
                        <button
                            onClick={toggleAutoRotation}
                            className={`w-full px-3 py-1 rounded text-xs font-mono border transition-colors ${isAutoRotating
                                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                                : 'bg-gray-700/50 border-gray-600 text-gray-400'
                                }`}
                        >
                            {isAutoRotating ? 'DISABLE AUTO-ROTATE' : 'ENABLE AUTO-ROTATE'}
                        </button>
                        <div className="space-y-1 text-xs font-mono text-gray-400">
                            <div>• Click & drag to rotate</div>
                            <div>• Scroll to zoom</div>
                            <div>• Click tracks for details</div>
                            <div>• Auto-pause on interaction</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Globe Container */}
            <main className="h-full pt-20">
                <Globe
                    ref={globeRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    backgroundColor="rgba(0,0,0,0)"

                    // Globe styling
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
                    showAtmosphere={true}
                    atmosphereColor="#f59e0b"
                    atmosphereAltitude={0.15}

                    // Countries polygons
                    polygonsData={countriesData.features}
                    polygonCapColor={() => 'rgba(74, 85, 104, 0.4)'}
                    polygonSideColor={() => 'rgba(74, 85, 104, 0.1)'}
                    polygonStrokeColor={() => '#9ca3af'}
                    polygonAltitude={0.005}

                    // Track points
                    pointsData={trackPoints}
                    pointLat="lat"
                    pointLng="lng"
                    pointColor="color"
                    pointAltitude={0.01}
                    pointRadius={0.1}
                    onPointClick={handleTrackClick}

                    // Performance and interaction
                    enablePointerInteraction={true}
                    onGlobeReady={() => {
                        if (globeRef.current) {
                            globeRef.current.pointOfView({ altitude: 2.5 });
                        }
                    }}

                    // Add interaction handlers
                    onGlobeClick={handleGlobeInteraction}
                    onPointHover={() => handleGlobeInteraction()}
                />
            </main>

            {/* Track Popup */}
            {selectedTrack && (
                <TrackPopup
                    track={selectedTrack}
                    onClose={handleClosePopup}
                />
            )}

            {/* Spy Effects */}
            <div className="absolute inset-0 pointer-events-none z-30">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent animate-pulse"></div>
            </div>

            <div
                className="absolute inset-0 pointer-events-none z-20 opacity-10"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(245, 158, 11, 0.3) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(245, 158, 11, 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px'
                }}
            ></div>
        </div>
    );
};

export default SpyDashboardGlobe;