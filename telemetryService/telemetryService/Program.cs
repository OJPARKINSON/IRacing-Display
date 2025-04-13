using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Core;
using InfluxDB.Client.Writes;
using File = System.IO.File;

class Program
{
    private static async Task Main()
    {
        var root = Directory.GetCurrentDirectory();
        var dotenv = Path.Combine(root, ".env.influxdb-admin-token");
        DotEnv.Load(dotenv);

        
        var url = Environment.GetEnvironmentVariable("INFLUX_URL");
        var token = Environment.GetEnvironmentVariable("INFLUX_TOKEN");
        using var client = new InfluxDBClient(url, token);

        
        Console.WriteLine($"Ping{client.PingAsync().Result.ToString()}");

        using (var writeApi = client.GetWriteApi())
        {
            Console.WriteLine("Data sent");
            var pointData = PointData.Measurement("hello").Tag("plane", "test-plane")
                .Field("value", 55D)
                .Timestamp(DateTime.UtcNow.AddSeconds(-10), WritePrecision.Ns);
            writeApi.WritePoint(pointData, "temp", "myorg");
            var temprature = new Temperature
                { Location = "south", Value = Random.Shared.Next(-30, 40), Time = DateTime.UtcNow };
            writeApi.WriteMeasurement(temprature, WritePrecision.Ns, "temp", "myorg");
        }
    } 
    
    [Measurement("temperature")]
    class Temperature
    {
        [Column("location", IsTag = true)] public string? Location { get; set; }
        [Column("value")] public double Value { get; set; }
        [Column(IsTimestamp = true)] public DateTime Time { get; set; }
    }
    
    public static class DotEnv
    {
        public static void Load(string filePath)
        {
            if (!File.Exists(filePath))
                return;

            foreach (var line in File.ReadAllLines(filePath))
            {
                var parts = line.Split(
                    '=',
                    StringSplitOptions.RemoveEmptyEntries);

                if (parts.Length != 2)
                    continue;

                Environment.SetEnvironmentVariable(parts[0], parts[1]);
            }
        }
    }
}

