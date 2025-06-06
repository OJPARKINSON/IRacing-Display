using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
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
            
            using var watcher = new FileSystemWatcher(@"./ibt_files/");
            
            watcher.NotifyFilter = NotifyFilters.Attributes
                                   | NotifyFilters.CreationTime
                                   | NotifyFilters.DirectoryName
                                   | NotifyFilters.FileName
                                   | NotifyFilters.LastAccess
                                   | NotifyFilters.LastWrite
                                   | NotifyFilters.Security
                                   | NotifyFilters.Size;
            
            watcher.Changed += OnChanged;
            watcher.Created += OnCreated;
            watcher.Error += OnError;
            
            watcher.Filter = "*.ibt";
            watcher.IncludeSubdirectories = true;
            watcher.EnableRaisingEvents = true;
            
            Console.WriteLine("Press enter to exit.");
            Console.ReadLine();

            var ibtOptions =
                new IBTOptions("./ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt", int.MaxValue);

            using var tc = TelemetryClient<TelemetryData>.Create(logger: logger, ibtOptions: ibtOptions);
            var count = -1;
            tc.OnTelemetryUpdate += OnTelemetryUpdate;

            await tc.Monitor(CancellationToken.None);
            void OnTelemetryUpdate(object? sender, TelemetryData e)
            {
                if (count != e.Lap)
                {
                    Console.WriteLine(e.ToString());
                    count++;
                }


            }

        }
        private record struct TelemetryData(Int32 Gear, Boolean IsOnTrackCar, Single RPM, Single Speed, Double BrakeRaw, Int32 Lap, Double LapDistPct, Double SteeringWheelAngle, Double VelocityY, Double VelocityX, Double Lat, Double Lon, Double SessionTime, Double LapCurrentLapTime, Double PlayerCarPosition, Double FuelLevel);

        private static void OnCreated(object sender, FileSystemEventArgs e)
        {
            if (e.ChangeType == WatcherChangeTypes.Created)
            {
                Console.WriteLine($"Created: {e.FullPath}");
                Console.WriteLine($"sender: {sender}");
            }
        }

        private static void OnChanged(object sender, FileSystemEventArgs e)
        {
            Console.WriteLine($"Changed: {e.FullPath}");
            Console.WriteLine($"sender: {sender}");
        }

        private static void OnError(object sender, ErrorEventArgs e)
        {
            var ex = e.GetException();
            if (ex != null)
            {
                Console.WriteLine($"Message: {ex.Message}");
                Console.WriteLine("Stacktrace:");
                Console.WriteLine(ex.StackTrace);
                Console.WriteLine();
            }
        }
    }
}