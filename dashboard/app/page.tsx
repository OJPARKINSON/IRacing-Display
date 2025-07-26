import SessionSelector from "@/components/SessionSelector";
import { getSessions } from "@/lib/questDb";

// Force dynamic rendering - prevent build-time execution
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
	let sessions: string | any[] = [];
	let errorMessage = null;

	try {
		console.log("🏠 Home page: Fetching sessions at RUNTIME...");
		sessions = await getSessions();
		console.log(`🏠 Home page: Found ${sessions.length} sessions`);
	} catch (error) {
		console.error("🏠 Home page: Error loading sessions:", error);
		errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
	}

	return (
		<div className="p-4 bg-gray-900 text-white min-h-screen">
			<h1 className="text-2xl font-bold mb-4">iRacing Telemetry Dashboard</h1>

			<div className="mb-6">
				<p className="mb-4">Please select a session for analysis</p>

				{errorMessage ? (
					<div className="bg-red-900 text-white p-4 rounded-lg mb-4">
						<p className="font-semibold">Database Connection Error</p>
						<p>
							Unable to connect to QuestDB. Please check your configuration.
						</p>
						<details className="mt-2">
							<summary className="cursor-pointer text-red-300">
								Error Details
							</summary>
							<p className="text-sm mt-2 text-red-300 font-mono">
								{errorMessage}
							</p>
						</details>
						<div className="mt-3 text-sm text-red-300">
							<p>Troubleshooting steps:</p>
							<ul className="list-disc list-inside mt-1 space-y-1">
								<li>Ensure QuestDB container is running</li>
								<li>Check network connectivity between containers</li>
								<li>Verify environment variables are set correctly</li>
								<li>Check container logs for more details</li>
							</ul>
						</div>
					</div>
				) : sessions.length > 0 ? (
					<SessionSelector sessions={sessions} />
				) : (
					<div className="bg-gray-800 p-4 rounded-lg">
						<p className="text-gray-400">No sessions found in the database.</p>
						<p className="text-gray-500 text-sm mt-2">
							Make sure telemetry data has been imported into QuestDB.
						</p>
					</div>
				)}
			</div>

			<div className="bg-gray-800 p-4 rounded-lg">
				<h2 className="text-lg font-semibold mb-2">System Status</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
					<div>
						<span className="text-gray-400">Database:</span>
						<span
							className={`ml-2 ${errorMessage ? "text-red-400" : "text-green-400"}`}
						>
							QuestDB {errorMessage ? "Disconnected" : "Connected"}
						</span>
					</div>
					<div>
						<span className="text-gray-400">Sessions Available:</span>
						<span className="text-blue-400 ml-2">{sessions.length}</span>
					</div>
					<div>
						<span className="text-gray-400">Processing:</span>
						<span className="text-green-400 ml-2">Runtime Dynamic</span>
					</div>
				</div>
			</div>
		</div>
	);
}
