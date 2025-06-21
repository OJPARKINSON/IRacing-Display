using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
using ingest.Models;
using System;
using System.IO;

namespace ingest
{
    internal class Program
    {
        private static async Task Main(string[] args)
        {
            var logger = LoggerFactory
                .Create(builder => builder.AddConsole().AddSimpleConsole(o => o.SingleLine = true))
                .CreateLogger("logger");


            Console.WriteLine("Press enter to exit.");
            Console.ReadLine();

            DirWatcher watcher = new DirWatcher();
            watcher.Watch("./ibt_files/");

            var ibtOptions =
                new IBTOptions("./ibt_files/", int.MaxValue);

            using var telemetryClient = TelemetryClient<TelemetryData>.Create(logger: logger, ibtOptions: ibtOptions);
            var count = -1;
            telemetryClient.OnTelemetryUpdate += OnTelemetryUpdate;

            await telemetryClient.Monitor(CancellationToken.None);
            void OnTelemetryUpdate(object? sender, TelemetryData e)
            {
                if (count != e.Lap)
                {
                    Console.WriteLine(e.ToString());
                    count++;
                }


            }

        }

    }
}