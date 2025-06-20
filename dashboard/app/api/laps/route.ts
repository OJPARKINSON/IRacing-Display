import { NextRequest, NextResponse } from "next/server";
import { getInfluxDBClient, influxConfig } from "@/lib/influxdb";
import { LapRow } from "@/lib/utils";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const sessionId = searchParams.get("sessionId");

	if (!sessionId) {
		return NextResponse.json(
			{ error: "Session ID is required" },
			{ status: 400 },
		);
	}

	try {
		const client = getInfluxDBClient();
		const queryApi = client.getQueryApi(influxConfig.org);

		const query = `
      from(bucket: "${sessionId}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "telemetry_ticks")
        |> keep(columns: ["lap_id"])
        |> unique(column: "lap_id")
        |> sort(columns: ["lap_id"])
    `;

		const result = await queryApi.collectRows<LapRow>(query);

		let uniqueLapIds: string[] = [];
		result.map((row) => {
			if (row.lap_id !== undefined && row.lap_id !== null) {
				uniqueLapIds.push(String(row.lap_id));
			}
		});

		const laps = Array.from(uniqueLapIds).sort(
			(a, b) => parseInt(a as string) - parseInt(b as string),
		);

		console.log(`Found ${laps.length} unique laps for session ${sessionId}`);

		return NextResponse.json({ laps });
	} catch (error) {
		console.error("Error fetching laps:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch laps",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
