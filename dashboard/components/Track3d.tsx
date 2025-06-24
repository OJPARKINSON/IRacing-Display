"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TelemetryDataPoint } from "@/lib/types";

interface Track3DProps {
    dataWithCoordinates: TelemetryDataPoint[];
    selectedPointIndex: number;
    selectedLapPct: number;
    isScrubbing: boolean;
    onPointClick?: (index: number) => void;
}

export default function Track3D({
    dataWithCoordinates,
    selectedPointIndex,
    isScrubbing,
    onPointClick,
}: Track3DProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const trackMeshRef = useRef<THREE.Mesh | null>(null);
    const speedLineRef = useRef<THREE.Line | null>(null);
    const accelerationLineRef = useRef<THREE.Line | null>(null);
    const markerMeshRef = useRef<THREE.Group | null>(null);
    const animationIdRef = useRef<number | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showSpeedLine, setShowSpeedLine] = useState(true);
    const [showAccelLine, setShowAccelLine] = useState(true);
    const [showTrackSurface, setShowTrackSurface] = useState(true);

    // Initialize 3D scene
    useEffect(() => {
        if (!mountRef.current || sceneRef.current) return;

        try {
            console.log('Initializing 3D track visualization...');

            // Scene setup with better background
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0f1a); // Dark blue instead of black
            scene.fog = new THREE.Fog(0x0a0f1a, 50, 200); // Add atmospheric fog
            sceneRef.current = scene;

            // Camera setup with better positioning
            const camera = new THREE.PerspectiveCamera(
                60, // Slightly wider field of view
                (mountRef.current?.clientWidth || 800) / (mountRef.current?.clientHeight || 600),
                0.1,
                1000
            );
            camera.position.set(0, 80, 80); // Higher and further back
            camera.lookAt(0, 0, 0);
            cameraRef.current = camera;

            // Renderer setup with better quality
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "high-performance"
            });
            renderer.setSize(
                mountRef.current?.clientWidth || 800,
                mountRef.current?.clientHeight || 600
            );
            renderer.setClearColor(0x0a0f1a, 1);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            rendererRef.current = renderer;

            mountRef.current.appendChild(renderer.domElement);

            // Enhanced lighting setup
            const ambientLight = new THREE.AmbientLight(0x4a5568, 0.4); // Soft ambient light
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(50, 100, 50);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            scene.add(directionalLight);

            // Add rim lighting for better depth perception
            const rimLight = new THREE.DirectionalLight(0x00ff88, 0.3);
            rimLight.position.set(-50, 50, -50);
            scene.add(rimLight);

            // Add ground plane for reference
            const groundGeometry = new THREE.PlaneGeometry(500, 500);
            const groundMaterial = new THREE.MeshLambertMaterial({
                color: 0x1a202c,
                transparent: true,
                opacity: 0.3
            });
            const ground = new THREE.Mesh(groundGeometry, groundMaterial);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = -5;
            ground.receiveShadow = true;
            scene.add(ground);

            // Controls (enhanced mouse controls)
            let mouseDown = false;
            let mouseX = 0;
            let mouseY = 0;

            const handleMouseDown = (event: MouseEvent) => {
                mouseDown = true;
                mouseX = event.clientX;
                mouseY = event.clientY;
                renderer.domElement.style.cursor = 'grabbing';
            };

            const handleMouseUp = () => {
                mouseDown = false;
                renderer.domElement.style.cursor = 'grab';
            };

            const handleMouseMove = (event: MouseEvent) => {
                if (!mouseDown) return;

                const deltaX = event.clientX - mouseX;
                const deltaY = event.clientY - mouseY;

                // Rotate camera around the center
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(camera.position);
                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                camera.position.setFromSpherical(spherical);
                camera.lookAt(0, 0, 0);

                mouseX = event.clientX;
                mouseY = event.clientY;
            };

            const handleWheel = (event: WheelEvent) => {
                event.preventDefault();
                const scale = event.deltaY > 0 ? 1.1 : 0.9;
                const newPosition = camera.position.clone().multiplyScalar(scale);

                // Limit zoom range
                const distance = newPosition.length();
                if (distance > 20 && distance < 300) {
                    camera.position.copy(newPosition);
                }
            };

            // Set cursor style
            renderer.domElement.style.cursor = 'grab';

            renderer.domElement.addEventListener('mousedown', handleMouseDown);
            renderer.domElement.addEventListener('mouseup', handleMouseUp);
            renderer.domElement.addEventListener('mousemove', handleMouseMove);
            renderer.domElement.addEventListener('wheel', handleWheel);

            // Animation loop
            const animate = () => {
                animationIdRef.current = requestAnimationFrame(animate);

                if (rendererRef.current && cameraRef.current) {
                    rendererRef.current.render(scene, camera);
                }
            };
            animate();

            setIsLoading(false);
            console.log('3D scene initialized successfully');

            // Cleanup function
            return () => {
                if (animationIdRef.current) {
                    cancelAnimationFrame(animationIdRef.current);
                }

                renderer.domElement.removeEventListener('mousedown', handleMouseDown);
                renderer.domElement.removeEventListener('mouseup', handleMouseUp);
                renderer.domElement.removeEventListener('mousemove', handleMouseMove);
                renderer.domElement.removeEventListener('wheel', handleWheel);

                if (mountRef.current && renderer.domElement) {
                    mountRef.current.removeChild(renderer.domElement);
                }

                renderer.dispose();
                sceneRef.current = null;
                rendererRef.current = null;
                cameraRef.current = null;
            };
        } catch (error) {
            console.error("Error initializing 3D scene:", error);
            setError("Failed to initialize 3D visualization");
            setIsLoading(false);
        }
    }, []);

    // Update track geometry when data changes
    useEffect(() => {
        if (!sceneRef.current || !dataWithCoordinates.length || isLoading) return;

        try {
            console.log('Creating 3D track from', dataWithCoordinates.length, 'points');

            // Clear previous track objects
            if (trackMeshRef.current) {
                sceneRef.current.remove(trackMeshRef.current);
            }
            if (speedLineRef.current) {
                sceneRef.current.remove(speedLineRef.current);
            }
            if (accelerationLineRef.current) {
                sceneRef.current.remove(accelerationLineRef.current);
            }

            // Convert GPS coordinates to 3D coordinates
            const trackPoints3D = convertToTrack3D(dataWithCoordinates);

            // Create track surface
            if (showTrackSurface) {
                const trackGeometry = createTrackGeometry(trackPoints3D);
                const trackMaterial = new THREE.MeshLambertMaterial({
                    color: 0x2d3748,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                });
                const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
                trackMesh.castShadow = true;
                trackMesh.receiveShadow = true;
                sceneRef.current.add(trackMesh);
                trackMeshRef.current = trackMesh;
            }

            // Create speed line (blue)
            if (showSpeedLine) {
                const speedLine = createDataLine(trackPoints3D, 'speed', 0x3182ce);
                if (speedLine) {
                    sceneRef.current.add(speedLine);
                    speedLineRef.current = speedLine;
                }
            }

            // Create acceleration line (green)
            if (showAccelLine) {
                const accelerationLine = createDataLine(trackPoints3D, 'acceleration', 0x38a169);
                if (accelerationLine) {
                    sceneRef.current.add(accelerationLine);
                    accelerationLineRef.current = accelerationLine;
                }
            }

            console.log('3D track created successfully');
        } catch (error) {
            console.error("Error creating 3D track:", error);
            setError("Failed to create 3D track visualization");
        }
    }, [dataWithCoordinates, isLoading, showSpeedLine, showAccelLine, showTrackSurface]);

    // Update selected point marker
    useEffect(() => {
        if (!sceneRef.current || !dataWithCoordinates.length || selectedPointIndex < 0) return;

        // Clear previous marker
        if (markerMeshRef.current) {
            sceneRef.current.remove(markerMeshRef.current);
        }

        const selectedPoint = dataWithCoordinates[selectedPointIndex];
        if (!selectedPoint || !selectedPoint.Lat || !selectedPoint.Lon) return;

        // Convert to 3D coordinates
        const point3D = gpsTo3D(selectedPoint.Lat, selectedPoint.Lon, (selectedPoint.Alt || 0) * 3);

        // Create enhanced marker
        const markerGeometry = new THREE.SphereGeometry(3, 16, 16);
        const markerMaterial = new THREE.MeshLambertMaterial({
            color: 0xffd700,
            emissive: 0x332200
        });
        const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        markerMesh.position.set(point3D.x, point3D.y + 8, point3D.z);

        // Add glowing effect
        const glowGeometry = new THREE.SphereGeometry(4, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 0.3
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.copy(markerMesh.position);

        // Group marker and glow
        const markerGroup = new THREE.Group();
        markerGroup.add(markerMesh);
        markerGroup.add(glowMesh);

        sceneRef.current.add(markerGroup);
        markerMeshRef.current = markerGroup;
    }, [selectedPointIndex, dataWithCoordinates]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

            const width = mountRef.current.clientWidth;
            const height = mountRef.current.clientHeight;

            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Helper functions
    const convertToTrack3D = (data: TelemetryDataPoint[]) => {
        return data.map(point => {
            // Use real iRacing altitude data if available, with enhanced scaling for visualization
            const realElevation = point.Alt || 0; // Real altitude in meters
            const elevationScale = 2; // Reduced scale for better proportions

            const pos3D = gpsTo3D(point.Lat, point.Lon, realElevation * elevationScale);
            return {
                ...pos3D,
                speed: point.normalizedSpeed || 0,
                acceleration: point.normalizedAcceleration || 0,
                realElevation: realElevation,
                originalIndex: point.originalIndex || 0,
            };
        });
    };

    const gpsTo3D = (lat: number, lon: number, elevation: number) => {
        // Convert GPS coordinates to local 3D coordinates
        const scale = 100000; // Scale factor to make the track visible

        // Use the first point as origin to center the track
        const originLat = dataWithCoordinates[0]?.Lat || 0;
        const originLon = dataWithCoordinates[0]?.Lon || 0;

        return {
            x: (lon - originLon) * scale,
            y: elevation, // Use real elevation (already scaled)
            z: (lat - originLat) * scale,
        };
    };

    const createTrackGeometry = (points: any[]) => {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];

        // Create track surface using a ribbon/strip approach
        const trackWidth = 15; // Slightly wider track

        for (let i = 0; i < points.length - 1; i++) {
            const point1 = points[i];
            const point2 = points[i + 1];

            // Calculate perpendicular direction for track width
            const forward = new THREE.Vector3(
                point2.x - point1.x,
                point2.y - point1.y,
                point2.z - point1.z
            ).normalize();

            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(forward, up).normalize();

            // Create quad vertices
            const leftOffset = right.clone().multiplyScalar(-trackWidth / 2);
            const rightOffset = right.clone().multiplyScalar(trackWidth / 2);

            // Left edge
            vertices.push(
                point1.x + leftOffset.x,
                point1.y + leftOffset.y,
                point1.z + leftOffset.z
            );
            // Right edge
            vertices.push(
                point1.x + rightOffset.x,
                point1.y + rightOffset.y,
                point1.z + rightOffset.z
            );

            if (i < points.length - 2) {
                const baseIndex = i * 2;
                // Create triangles for the track surface
                indices.push(
                    baseIndex, baseIndex + 1, baseIndex + 2,
                    baseIndex + 1, baseIndex + 3, baseIndex + 2
                );
            }
        }

        geometry.setIndex(indices);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();

        return geometry;
    };

    const createDataLine = (points: any[], dataType: 'speed' | 'acceleration', color: number) => {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];

        for (const point of points) {
            // Position - offset above track surface
            vertices.push(point.x, point.y + 8, point.z);

            // Color based on data value
            const intensity = dataType === 'speed' ? point.speed : point.acceleration;
            const colorObj = new THREE.Color(color);
            colorObj.multiplyScalar(0.4 + intensity * 0.6); // Better color variation
            colors.push(colorObj.r, colorObj.g, colorObj.b);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 4 // Thicker lines
        });

        return new THREE.Line(geometry, material);
    };

    if (error) {
        return (
            <div className="h-[600px] bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center text-red-400">
                    <p className="mb-2">3D Visualization Error</p>
                    <p className="text-sm text-gray-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[600px] bg-gray-800 rounded-lg relative overflow-hidden">
            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-gray-800 bg-opacity-90 flex items-center justify-center z-20">
                    <div className="text-center text-white">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p>Loading 3D Track...</p>
                    </div>
                </div>
            )}

            {/* Enhanced Controls */}
            <div className="absolute top-4 left-4 z-10 bg-gray-900 bg-opacity-90 backdrop-blur-sm border border-gray-700 rounded-lg p-3 text-white text-sm max-w-xs">
                <div className="font-semibold mb-2 text-blue-400">3D Controls</div>
                <div className="space-y-1 text-xs text-gray-300">
                    <div>🖱️ Click & drag to rotate</div>
                    <div>🔄 Scroll to zoom</div>
                    <div>📍 GPS Points: {dataWithCoordinates.length}</div>
                </div>

                {/* Layer toggles */}
                <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="font-semibold mb-2 text-green-400">Layers</div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showTrackSurface}
                                onChange={(e) => setShowTrackSurface(e.target.checked)}
                                className="w-3 h-3 rounded"
                            />
                            <span className="text-xs">Track Surface</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showSpeedLine}
                                onChange={(e) => setShowSpeedLine(e.target.checked)}
                                className="w-3 h-3 rounded"
                            />
                            <div className="w-3 h-1 bg-blue-400"></div>
                            <span className="text-xs">Speed Data</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showAccelLine}
                                onChange={(e) => setShowAccelLine(e.target.checked)}
                                className="w-3 h-3 rounded"
                            />
                            <div className="w-3 h-1 bg-green-400"></div>
                            <span className="text-xs">Acceleration</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Enhanced Legend */}
            <div className="absolute top-4 right-4 z-10 bg-gray-900 bg-opacity-90 backdrop-blur-sm border border-gray-700 rounded-lg p-3 text-white text-sm">
                <div className="font-semibold mb-2 text-purple-400">Visualization</div>
                <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-1 bg-blue-400"></div>
                        <span>Speed Intensity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-1 bg-green-400"></div>
                        <span>Lateral G-Force</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        <span>Selected Point</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-2 bg-gray-600"></div>
                        <span>Track Surface</span>
                    </div>
                </div>
            </div>

            {/* Current Point Info */}
            {selectedPointIndex >= 0 && dataWithCoordinates[selectedPointIndex] && (
                <div className="absolute bottom-4 left-4 z-10 bg-gray-900 bg-opacity-90 backdrop-blur-sm border border-gray-700 rounded-lg p-3 text-white text-sm">
                    <div className="font-semibold mb-2 text-yellow-400">Selected Point</div>
                    <div className="space-y-1 text-xs">
                        <div>Lap: {dataWithCoordinates[selectedPointIndex].LapDistPct.toFixed(1)}%</div>
                        <div>Speed: {dataWithCoordinates[selectedPointIndex].Speed.toFixed(1)} km/h</div>
                        {dataWithCoordinates[selectedPointIndex].LatAccel && (
                            <div>Lateral G: {(dataWithCoordinates[selectedPointIndex].LatAccel! / 9.81).toFixed(2)}g</div>
                        )}
                        {dataWithCoordinates[selectedPointIndex].Alt && (
                            <div>Altitude: {dataWithCoordinates[selectedPointIndex].Alt!.toFixed(1)}m</div>
                        )}
                    </div>
                </div>
            )}

            {/* 3D Canvas Container */}
            <div
                ref={mountRef}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
}