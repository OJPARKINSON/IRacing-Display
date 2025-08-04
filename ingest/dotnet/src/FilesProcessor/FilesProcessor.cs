using System.Threading.Channels;
using ingest.PubSub;
using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;

namespace ingest.FilesProcessor;

public class FilesProcessor
{
    private readonly SemaphoreSlim _workerSemaphore;
    private readonly Channel<string> _fileQueue;

    public FilesProcessor(List<string> fileQueue)
    {
        foreach (var file in fileQueue)
        {
            _fileQueue.Writer.WriteAsync(file);
        }
    }

    async public void Process(ILogger logger)
    {
        var ps = new BufferedPubSub(
            maxBatchSize: 1000,
            maxBatchBytes: 250000,
            flushInterval: TimeSpan.FromMilliseconds(50)
        );

        using var cts = new CancellationTokenSource();
        
        ITelemetryClient<TelemetryData>? telemetryClient = null;
        

        await foreach (var file in _fileQueue.Reader.ReadAllAsync())
        {
            var process = new IBTFileProcessor(file, telemetryClient, logger, ps);
        }
    }
}