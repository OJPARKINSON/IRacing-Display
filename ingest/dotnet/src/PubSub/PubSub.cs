using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
using RabbitMQ.Client;

namespace ingest.PubSub;

class PubSub
{
    private IConnection? _connection;
    private IChannel? _channel;
    private readonly object _lockObject = new object();
    private bool _isConnected = false;

    public async Task InitializeAsync()
    {
        if (_isConnected) return;

        lock (_lockObject)
        {
            if (_isConnected) return;

            var factory = new ConnectionFactory();
            factory.Uri = new Uri("amqp://guest:guest@localhost:5672/");

            _connection = factory.CreateConnectionAsync().Result;
            _channel = _connection.CreateChannelAsync(null).Result;

            _isConnected = true;
            Console.WriteLine("RabbitMQ connection established and reused for all messages");
        }
    }


    public async void Publish(ILogger logger, TelemetryData data, string trackName = "", string trackId = "", int sessionId = 0)
    {
        try
        {
            await InitializeAsync();

            if (_channel == null)
            {
                Console.WriteLine("RabbitMQ channel established and reused for all messages");
            }

            Dictionary<string, object?>? headers = new Dictionary<string, object?>();
            headers.Add("worker_id", 1);
            headers.Add("batch_size", 1000);
            headers.Add("session_id", sessionId);

            var tick = new
            {
                lap_id = data.Lap.ToString(),
                speed = data.Speed,
                lap_dist_pct = data.LapDistPct,
                session_id = sessionId,
                session_num = data.SessionNum,
                session_time = data.SessionTime,
                car_id = data.PlayerCarIdx,
                track_name = trackName,
                track_id = trackId,
                worker_id = 1,
                steering_wheel_angle = data.SteeringWheelAngle,
                player_car_position = data.PlayerCarPosition,
                velocity_x = data.VelocityX,
                velocity_y = data.VelocityY,
                velocity_z = data.VelocityZ,
                fuel_level = data.FuelLevel,
                throttle = data.Throttle,
                brake = data.Brake,
                rpm = data.RPM,
                lat = data.Lat,
                lon = data.Lon,
                gear = data.Gear,
                alt = data.Alt,
                lat_accel = data.LatAccel,
                long_accel = data.LongAccel,
                vert_accel = data.VertAccel,
                pitch = data.Pitch,
                roll = data.Roll,
                yaw = data.Yaw,
                yaw_north = data.YawNorth,
                voltage = data.Voltage,
                lapLastLapTime = data.LapLastLapTime,
                waterTemp = data.WaterTemp,
                lapDeltaToBestLap = data.LapDeltaToBestLap,
                lapCurrentLapTime = data.LapCurrentLapTime,
                lFpressure = data.LFpressure,
                rFpressure = data.RFpressure,
                lRpressure = data.LRpressure,
                rRpressure = data.RRpressure,
                lFtempM = data.LFtempM,
                rFtempM = data.RFtempM,
                lRtempM = data.LRtempM,
                rRtempM = data.RRtempM,
                tick_time = DateTime.UtcNow
            };
            
            
            var tickArray = new[] { tick };

            string jsonString = JsonSerializer.Serialize(tickArray, new JsonSerializerOptions
            {
                WriteIndented = false
            });

            byte[] messageBodyBytes = System.Text.Encoding.UTF8.GetBytes(jsonString);

            var props = new BasicProperties();
            props.ContentType = "application/json";
            props.DeliveryMode = DeliveryModes.Transient;
            props.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            props.Headers = headers;

            await _channel.BasicPublishAsync("telemetry_topic", "telemetry.ticks", false, props, messageBodyBytes,
                new CancellationToken());
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            _isConnected = false;
        }
    }

    public void Dispose()
    {
        lock (_lockObject)
        {
            _channel?.CloseAsync().Wait();
            _connection?.CloseAsync().Wait();
            _channel?.Dispose();
            _connection?.Dispose();
            _isConnected = false;
            Console.WriteLine("RabbitMQ connection closed");
        }
    }
}