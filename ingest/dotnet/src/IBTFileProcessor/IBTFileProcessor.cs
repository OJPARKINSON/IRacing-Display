using ingest.PubSub;
using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
using SVappsLAB.iRacingTelemetrySDK.Models;

namespace ingest.IBTFileProcessor;

public class IBTFileProcessor
{
    private static string _trackName = "";
    private static string _trackId = "";
    private static int _sessionId = 1;
    
    

    async public void  ProcessFile(string filePath, ITelemetryClient<TelemetryData> telemetryClient, ILogger logger,
        ingest.PubSub.BufferedPubSub ps)
    {
        var ibtOptions = new IBTOptions(filePath);
        try
        {
            telemetryClient = TelemetryClient<TelemetryData>.Create(logger: logger, ibtOptions: ibtOptions);

            telemetryClient.OnSessionInfoUpdate += OnSessionInfoUpdate;
            telemetryClient.OnTelemetryUpdate += (sender, e) => OnTelemetryUpdate(sender, e, ps, logger);

            logger.LogInformation("Starting telemetry monitoring...");

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
    void OnTelemetryUpdate(object? sender, TelemetryData e, BufferedPubSub pubSub, ILogger log)
    {
        try
        {
            pubSub.Publish(log, e, _trackName, _trackId, _sessionId);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error publishing telemetry data");
        }
    }

    void OnSessionInfoUpdate(object? sender, TelemetrySessionInfo e, ILogger logger)
    {
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
