import { NextResponse } from "next/server";
import { getInfluxDBClient, influxConfig } from "../../../lib/influxdb";

export async function GET() {
	try {
		const client = getInfluxDBClient();

		const queryApi = client.getQueryApi(influxConfig.org);
		const healthQuery = `from(bucket: "_monitoring")
                         |> range(start: -10s)
                         |> limit(n: 1)`;

		await queryApi.collectRows(healthQuery);

		return NextResponse.json({
			status: "ok",
			timestamp: new Date().toISOString(),
			message: "Successfully connected to InfluxDB",
		});
	} catch (error) {
		console.error("Health check failed:", error);
		return NextResponse.json(
			{
				status: "error",
				message: "Could not connect to InfluxDB",
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 503 },
		);
	}
}
