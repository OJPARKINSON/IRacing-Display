import { NextRequest, NextResponse } from "next/server";
import { getInfluxDBClient, influxConfig } from "@/lib/influxdb";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const sessionId = searchParams.get("sessionId");
	const lapId = searchParams.get("lapId");
	const useSeparateBuckets = process.env.USE_SEPARATE_BUCKETS === "true";

	if (!sessionId || !lapId) {
		return NextResponse.json(
			{ error: "Session ID and Lap ID are required" },
			{ status: 400 },
		);
	}

	try {
		const client = getInfluxDBClient();
		const queryApi = client.getQueryApi(influxConfig.org);

		const bucketName = sessionId;

		const query = `
      from(bucket: "${bucketName}")
        |> range(start: -365d)
        |> filter(fn: (r) => r._measurement == "telemetry_ticks")
        |> filter(fn: (r) => r.lap_id == "${lapId}")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["session_time"])
    `;

		console.log(
			`Executing optimized query on bucket: ${bucketName} for lap: ${lapId}${useSeparateBuckets ? "" : " and session: " + sessionId
			}`,
		);

		const data = await queryApi.collectRows(query);

		return NextResponse.json({ data });
	} catch (error) {
		console.error("Error fetching telemetry data:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch telemetry data",
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
