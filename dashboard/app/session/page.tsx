import { Suspense } from "react"
import TelemetryPage from "./[sessionId]"
import { processIRacingDataWithGPS, TelemetryRes } from "@/lib/Fetch";
import { Client, QueryResult } from "pg"

interface Params {
	params: Promise<{
		sessionId: string;
		lapId: string;
	}>;
}

export default async function Page({ searchParams }: any) {
	console.log(await searchParams)
	const telemetryData = getTelemetryData("75385817", 1)

	return (
		<Suspense fallback={<div>Loading...</div>}>
			<TelemetryPage telemetryData={telemetryData} sessionId="77537439" searchParams={searchParams} />
		</Suspense>
	)
}

const getTelemetryData = async (sessionId: string, lapId: number) => {
	const client = new Client({
		host: '127.0.0.1',
		port: 8812,
		user: 'admin',
		password: 'quest',
		database: 'qdb'
	})

	let telemetryData: [TelemetryRes | undefined, string[] | undefined, Error | undefined] = [undefined, undefined, undefined];

	try {
		await client.connect()
		console.log('Connected to QuestDB')

		const telemetry = await Promise.all([
			client.query(`SELECT * FROM TelemetryTicks WHERE session_id = '${sessionId}' AND lap_id = ${lapId}`)
			, client.query(`SELECT DISTINCT lap_id FROM TelemetryTicks WHERE session_id = '${sessionId}' ORDER BY lap_id`)]);
		console.log(`QuestDB version: ${telemetry[0].rowCount}, ${telemetry[1].rowCount}`)
		telemetryData = [processIRacingDataWithGPS(telemetry[0]), telemetry[1].rows as string[], undefined]
	} catch (error) {
		console.error('Connection error:', error)
		telemetryData = [undefined, undefined, new Error("errror")]
	} finally {
		// Close the connection
		await client.end()
		return telemetryData
	}

}