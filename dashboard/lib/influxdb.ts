import { InfluxDB } from "@influxdata/influxdb-client";


export const influxConfig = {
  url: process.env.INFLUXDB_URL || "http://influxdb:8086",
  token: process.env.INFLUXDB_TOKEN,
  org: process.env.INFLUXDB_ORG || "myorg",
  bucket: process.env.INFLUXDB_BUCKET || "telemetry",
};

export function getInfluxDBClient(): InfluxDB {
  return new InfluxDB({
    url: influxConfig.url,
    token: influxConfig.token,
  });
}
