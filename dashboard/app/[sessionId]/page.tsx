import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLaps, getTelemetryData } from "@/lib/questDb";
import TelemetryPage from "../../components/TelemetryPage";

// Force dynamic rendering - prevent build-time execution
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
	params: Promise<{ sessionId: string }>;
	searchParams: Promise<{ lapId?: string }>;
}

export default async function SessionPage({ params, searchParams }: PageProps) {
	const { sessionId } = await params;
	const { lapId } = await searchParams;

	// Default to lap 1 if no lapId provided
	const currentLapId = lapId ? Number.parseInt(lapId, 10) : 1;

	if (isNaN(currentLapId)) {
		notFound();
	}

	// Fetch data on the server at RUNTIME (not build time)
	try {
		console.log(
			`📊 Fetching data at RUNTIME for session: ${sessionId}, lap: ${currentLapId}`,
		);

		const [telemetryData, availableLaps] = await Promise.all([
			getTelemetryData(sessionId, currentLapId),
			getLaps(sessionId),
		]);

		if (!telemetryData) {
			notFound();
		}

		console.log(
			`✅ Successfully fetched telemetry data with ${telemetryData.dataWithGPSCoordinates?.length || 0} points`,
		);

		return (
			<Suspense fallback={<TelemetryLoadingSkeleton />}>
				<TelemetryPage
					initialTelemetryData={telemetryData}
					availableLaps={availableLaps}
					sessionId={sessionId}
					currentLapId={currentLapId}
				/>
			</Suspense>
		);
	} catch (error) {
		console.error("Error fetching telemetry data at runtime:", error);
		notFound();
	}
}

function TelemetryLoadingSkeleton() {
	return (
		<div className="p-4 bg-gray-900 text-white min-h-screen">
			<div className="animate-pulse">
				<div className="h-8 bg-gray-700 rounded w-64 mb-4" />
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
					<div className="col-span-2 h-96 bg-gray-700 rounded" />
					<div className="h-96 bg-gray-700 rounded" />
				</div>
			</div>
		</div>
	);
}
