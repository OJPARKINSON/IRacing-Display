// File: /app/api/health/route.ts
import { NextResponse } from "next/server";
import { getInfluxDBClient, influxConfig } from "../../../lib/influxdb";

export async function GET() {
  try {
    // Create a new InfluxDB client
    const client = getInfluxDBClient();

    // Instead of client.health(), we'll perform a simple query to check if InfluxDB is responding
    const queryApi = client.getQueryApi(influxConfig.org);
    const healthQuery = `from(bucket: "_monitoring")
                         |> range(start: -10s)
                         |> limit(n: 1)`;

    // Just trying to execute any query will tell us if the connection works
    await queryApi.collectRows(healthQuery);

    // If we get here without an error, the connection is working
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
      { status: 503 }
    );
  }
}
