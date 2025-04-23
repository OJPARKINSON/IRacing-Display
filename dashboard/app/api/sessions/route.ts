import { NextRequest, NextResponse } from "next/server";
import { getInfluxDBClient, influxConfig } from "@/lib/influxdb";
import { Bucket, BucketsAPI } from "@influxdata/influxdb-client-apis";

interface SessionInfo {
  id: string;
  bucket: string;
}

export async function GET(): Promise<
  NextResponse<SessionInfo[] | { error: string; message: string }>
> {
  try {
    const client = getInfluxDBClient();

    const bucketApi = new BucketsAPI(client);
    const bucketList = await bucketApi.getBuckets();

    console.log(`Found ${bucketList.buckets?.length} unique sessions`);
    console.log(bucketList.buckets);

    const sessionBuckets: SessionInfo[] = [];

    const bucketPrefix = `${influxConfig.bucket}_`;
    bucketList.buckets?.forEach((bucket: Bucket) => {
      if (bucket && bucket.name.startsWith(bucketPrefix)) {
        const sessionId = bucket.name.substring(bucketPrefix.length);
        sessionBuckets.push({
          id: sessionId,
          bucket: bucket.name,
        });
      }
    });

    console.log(`Found ${sessionBuckets.length} unique sessions`);

    return NextResponse.json(sessionBuckets);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch sessions",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
