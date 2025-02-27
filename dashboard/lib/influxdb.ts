// File: /lib/influxdb.ts
import fs from "fs";
import { InfluxDB } from "@influxdata/influxdb-client";

// Function to read token from file if provided
export function getToken(): string {
  const tokenPath = process.env.INFLUXDB_TOKEN_FILE;

  if (tokenPath && fs.existsSync(tokenPath)) {
    try {
      // Read the token and trim any whitespace
      return fs.readFileSync(tokenPath, "utf8").trim();
    } catch (error) {
      console.error(`Error reading token from ${tokenPath}:`, error);
    }
  }

  // Fall back to environment variable or default
  return process.env.INFLUXDB_TOKEN || "super-secret-token";
}

// Get InfluxDB configuration
export const influxConfig = {
  url: process.env.INFLUXDB_URL || "http://192.168.0.72:8086",
  token: getToken(),
  org: process.env.INFLUXDB_ORG || "myorg",
  bucket: process.env.INFLUXDB_BUCKET || "telemetry",
};

// Create InfluxDB client factory
export function getInfluxDBClient(): InfluxDB {
  return new InfluxDB({
    url: influxConfig.url,
    token: influxConfig.token,
  });
}
