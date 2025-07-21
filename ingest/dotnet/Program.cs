using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
using ingest.Models;
using System;
using System.IO;

namespace ingest
{
    [RequiredTelemetryVars(["Lap", "LapDistPct", "Speed", "Throttle", "Brake", "Gear", "RPM",
        "SteeringWheelAngle", "VelocityX", "VelocityY", "VelocityZ", "Lat", "Lon", "SessionTime",
        "PlayerCarPosition", "FuelLevel", "PlayerCarIdx", "SessionNum", "alt", "LatAccel", "LongAccel",
        "VertAccel", "pitch", "roll", "yaw", "YawNorth", "Voltage", "LapLastLapTime", "WaterTemp",
        "LapDeltaToBestLap", "LapCurrentLapTime", "LFpressure", "RFpressure", "LRpressure", "RRpressure", "LFtempM",
        "RFtempM", "LRtempM", "RRtempM"])]
    internal class Program
    {
        private static async Task Main(string[] args)
        {
            var logger = LoggerFactory
                .Create(builder => builder.AddConsole().AddSimpleConsole(o => o.SingleLine = true))
                .CreateLogger("logger");

            var ibtOptions =
                new IBTOptions(@"./ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt", int.MaxValue);

            using var telemetryClient = TelemetryClient<TelemetryData>.Create(logger: logger, ibtOptions: ibtOptions);
            telemetryClient.OnTelemetryUpdate += OnTelemetryUpdate;

            await telemetryClient.Monitor(CancellationToken.None);
            void OnTelemetryUpdate(object? sender, TelemetryData e)
            {
                logger.LogInformation("rpm: {rpm}, speed: {speed}, lap: {lap}", e.RPM, e.Speed, e.Lap);
            }

        }

    }
}