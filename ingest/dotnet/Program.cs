using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
using ingest.Models;
using System;
using System.IO;
using SVappsLAB.iRacingTelemetrySDK.Models;
using ingest.PubSub;

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
        private static bool _shutdownRequested = false;
        private static readonly object _shutdownLock = new object();

        private static async Task Main(string[] args)
        {
            var logger = LoggerFactory
                .Create(builder => builder.AddConsole().AddSimpleConsole(o => o.SingleLine = true))
                .CreateLogger("logger");

            var ibtOptions =
                new IBTOptions(@"./ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt", int.MaxValue);

            var ps = new BufferedPubSub(
                maxBatchSize: 1000,
                maxBatchBytes: 250000,
                flushInterval: TimeSpan.FromMilliseconds(50)
            );

            ITelemetryClient<TelemetryData>? telemetryClient = null;

            using var cts = new CancellationTokenSource();

            Console.CancelKeyPress += (sender, e) =>
            {
                lock (_shutdownLock)
                {
                    if (_shutdownRequested)
                    {
                        logger.LogWarning("Force shutdown requested!");
                        Environment.Exit(1);
                        return;
                    }

                    _shutdownRequested = true;
                    e.Cancel = true;

                    logger.LogInformation("Shutdown requested. Gracefully shutting down...");
                    cts.Cancel();
                }
            };

            try
            {
                telemetryClient = TelemetryClient<TelemetryData>.Create(logger: logger, ibtOptions: ibtOptions);

                telemetryClient.OnSessionInfoUpdate += OnSessionInfoUpdate;
                telemetryClient.OnTelemetryUpdate += (sender, e) => OnTelemetryUpdate(sender, e, ps, logger);

                logger.LogInformation("Starting telemetry monitoring...");

                await telemetryClient.Monitor(cts.Token);
            }
            catch (OperationCanceledException)
            {
                logger.LogInformation("Telemetry monitoring was cancelled");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during telemetry monitoring");
            }
            finally
            {
                logger.LogInformation("Performing final cleanup...");

                try
                {
                    using var flushCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    await ps.ForceFlush(_sessionId);
                    logger.LogInformation("Final flush completed");
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error during final flush");
                }

                try
                {
                    ps.Dispose();
                    logger.LogInformation("PubSub disposed");
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error disposing PubSub");
                }

                try
                {
                    telemetryClient?.Dispose();
                    logger.LogInformation("Telemetry client disposed");
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error disposing telemetry client");
                }

                logger.LogInformation("Application shutdown complete");
            }

            void OnTelemetryUpdate(object? sender, TelemetryData e, BufferedPubSub pubSub, ILogger log)
            {
                if (_shutdownRequested)
                {
                    log.LogInformation("Ignoring telemetry update due to shutdown request");
                    return;
                }

                try
                {
                    pubSub.Publish(log, e, _trackName, _trackId, _sessionId);
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Error publishing telemetry data");
                }
            }

            void OnSessionInfoUpdate(object? sender, TelemetrySessionInfo e)
            {
                if (_shutdownRequested) return;

                try
                {
                    var weekendInfo = e.WeekendInfo;
                    if (weekendInfo != null)
                    {
                        _trackName = weekendInfo.TrackDisplayShortName ?? "";
                        _trackName = _trackName.Replace(" ", "-");
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
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error in session info update");
                }
            }
        }
    }
}