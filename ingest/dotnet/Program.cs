using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
using ingest.Models;
using System;
using System.IO;
using SVappsLAB.iRacingTelemetrySDK.Models;

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
        private static string _trackName = "";
        private static string _trackId = "";
        private static int _sessionId = 1;
        
        private static async Task Main(string[] args)
        {
            var logger = LoggerFactory
                .Create(builder => builder.AddConsole().AddSimpleConsole(o => o.SingleLine = true))
                .CreateLogger("logger");

            var ibtOptions =
                new IBTOptions(@"./ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt", int.MaxValue);

            var ps = new PubSub.PubSub();
            
            using var telemetryClient = TelemetryClient<TelemetryData>.Create(logger: logger, ibtOptions: ibtOptions);

            telemetryClient.OnSessionInfoUpdate += OnSessionInfoUpdate;
            telemetryClient.OnTelemetryUpdate += OnTelemetryUpdate;
            await telemetryClient.Monitor(CancellationToken.None);

            
            void OnTelemetryUpdate(object? sender, TelemetryData e)
            {
                ps.Publish(logger, e, _trackName, _trackId, _sessionId);
            }

            void OnSessionInfoUpdate(object? sender, TelemetrySessionInfo e)
            {
                var weekendInfo = e.WeekendInfo;
                if (weekendInfo != null)
                {
                    _trackName = weekendInfo.TrackDisplayShortName ?? "";
                    _trackId = weekendInfo.TrackID.ToString() ?? "";
                    _sessionId = weekendInfo.SubSessionID;
                    
                    logger.LogInformation($"Track Name: {_trackName}, Session ID: {_sessionId}");
                }

                if (e.SessionInfo?.Sessions != null && e.SessionInfo.Sessions.Count > 0)
                {
                    int sessionIndex = 0;
                    if (e.SessionInfo.Sessions.Count > 2)
                    {
                        sessionIndex = 2;
                    }
                    
                    var selectedSession = e.SessionInfo.Sessions[sessionIndex];
                    
                    logger.LogInformation($"SessionIndex: {sessionIndex}");
                }
                else
                {
                    logger.LogInformation($"No sessions found");
                }
            }

        }

    }
}