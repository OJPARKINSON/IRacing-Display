using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;

namespace ingest
{
    internal class Program
    {
        static async Task Main(string[] args)
        { 
            var counter = 0;
            var logger = LoggerFactory
                .Create(builder => builder.AddConsole().AddSimpleConsole(o => o.SingleLine = true))
                .CreateLogger("logger");

            IBTOptions? ibtOptions =
                new IBTOptions("./ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt", int.MaxValue);

            using var tc = TelemetryClient<TelemetryData>.Create(logger: logger, ibtOptions: ibtOptions);
            int count = -1;
            tc.OnTelemetryUpdate += OnTelemetryUpdate;
            
            await tc.Monitor(CancellationToken.None);
            void OnTelemetryUpdate(object? sender, TelemetryData e)
            {
                if (!e.IsOnTrackCar)
                    return;

                if (count != e.Lap)
                {
                    Console.WriteLine(e.ToString());
                    count++;
                }
                
                
            }
            
        }
        private record struct TelemetryData(Int32 Gear,Boolean IsOnTrackCar,Single RPM,Single Speed, Double BrakeRaw, Int32 Lap, Double LapDistPct, Double SteeringWheelAngle, Double VelocityY, Double VelocityX, Double Lat, Double Lon, Double SessionTime, Double LapCurrentLapTime, Double PlayerCarPosition, Double FuelLevel);
    }
}