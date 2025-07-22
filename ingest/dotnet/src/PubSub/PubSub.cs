using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using SVappsLAB.iRacingTelemetrySDK;
using RabbitMQ.Client;

namespace ingest.PubSub;

class BufferedPubSub : IDisposable
{
    private IConnection? _connection;
    private IChannel? _channel;
    private readonly object _lockObject = new object();
    private bool _isConnected = false;
    private bool _disposed = false;

    private readonly int _maxBatchSize;
    private readonly int _maxBatchBytes;
    private readonly TimeSpan _flushInterval;

    private readonly List<object> _buffer = new();
    private readonly Timer _flushTimer;
    private int _currentBufferBytes;

    private long _totalPointsBuffered;
    private long _totalBatchesSent;
    private DateTime _lastFlush = DateTime.UtcNow;

    private readonly CancellationTokenSource _cancellationTokenSource = new();

    public BufferedPubSub(
        int maxBatchSize = 1000,
        int maxBatchBytes = 250000,
        TimeSpan? flushInterval = null)
    {
        _maxBatchSize = maxBatchSize;
        _maxBatchBytes = maxBatchBytes;
        _flushInterval = flushInterval ?? TimeSpan.FromMilliseconds(50);

        _flushTimer = new Timer(FlushTimerCallback, null, _flushInterval, _flushInterval);
        
        Console.WriteLine($"BufferedPubSub initialized: maxBatch={_maxBatchSize}, maxBytes={_maxBatchBytes}, flushInterval={_flushInterval.TotalMilliseconds}ms");
    }

    public async Task InitializeAsync()
    {
        if (_isConnected || _disposed) return;

        lock (_lockObject)
        {
            if (_isConnected || _disposed) return;

            try
            {
                var factory = new ConnectionFactory();
                factory.Uri = new Uri("amqp://guest:guest@localhost:5672/");

                _connection = factory.CreateConnectionAsync().Result;
                _channel = _connection.CreateChannelAsync(null).Result;

                _isConnected = true;
                Console.WriteLine("RabbitMQ connection established and reused for all messages");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to initialize RabbitMQ connection: {ex.Message}");
                _isConnected = false;
                throw;
            }
        }
    }

    public async void Publish(ILogger logger, TelemetryData data, string trackName = "", string trackId = "", int sessionId = 0)
    {
        if (_disposed || _cancellationTokenSource.Token.IsCancellationRequested) 
        {
            logger.LogWarning("Publish called after disposal or cancellation");
            return;
        }

        try
        {
            await InitializeAsync();

            if (_channel == null)
            {
                Console.WriteLine("RabbitMQ channel not available");
                return;
            }

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

            await BufferTick(tick, sessionId);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in buffered publish: {ex}");
            _isConnected = false;
        }
    }

    private async Task BufferTick(object tick, int sessionId)
    {
        if (_disposed || _cancellationTokenSource.Token.IsCancellationRequested) return;

        bool shouldFlush = false;
        
        lock (_lockObject)
        {
            if (_disposed) return;

            _buffer.Add(tick);
            _currentBufferBytes += EstimateTickSize(tick);
            _totalPointsBuffered++;

            shouldFlush = _buffer.Count >= _maxBatchSize || _currentBufferBytes >= _maxBatchBytes;
            
            if (_buffer.Count % 500 == 0)
            {
                Console.WriteLine($"Buffer status: {_buffer.Count}/{_maxBatchSize} points, {_currentBufferBytes}/{_maxBatchBytes} bytes");
            }
        }

        if (shouldFlush)
        {
            Console.WriteLine($"Triggering immediate flush: {_buffer.Count} points, {_currentBufferBytes} bytes");
            await FlushBuffer(sessionId);
        }
    }

    private void FlushTimerCallback(object? state)
    {
        if (_disposed || _cancellationTokenSource.Token.IsCancellationRequested) return;

        _ = Task.Run(async () =>
        {
            try
            {
                await FlushBuffer(1);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in timer-triggered flush: {ex.Message}");
            }
        }, _cancellationTokenSource.Token);
    }

    private async Task FlushBuffer(int sessionId)
    {
        if (_disposed || _cancellationTokenSource.Token.IsCancellationRequested) return;

        List<object> dataToFlush;

        lock (_lockObject)
        {
            if (_disposed || _buffer.Count == 0)
                return;

            dataToFlush = new List<object>(_buffer);
            _buffer.Clear();
            _currentBufferBytes = 0;
        }

        try
        {
            await SendBatchToRabbitMQ(dataToFlush, sessionId);

            lock (_lockObject)
            {
                _totalBatchesSent++;
                _lastFlush = DateTime.UtcNow;
            }

            if (_totalBatchesSent % 100 == 0)
            {
                var elapsed = DateTime.UtcNow - _lastFlush;
                if (elapsed.TotalSeconds > 0)
                {
                    var rate = _totalPointsBuffered / elapsed.TotalSeconds;
                    Console.WriteLine($"Flush metrics: {_totalPointsBuffered} points in {_totalBatchesSent} batches ({rate:F0} points/sec)");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR flushing buffer to RabbitMQ: {ex.Message}");
        }
    }

    private async Task SendBatchToRabbitMQ(List<object> batch, int sessionId)
    {
        if (batch.Count == 0 || _channel == null || _disposed) return;

        try
        {
            Dictionary<string, object?> headers = new Dictionary<string, object?>();
            headers.Add("worker_id", 1);
            headers.Add("batch_size", batch.Count);
            headers.Add("session_id", sessionId);

            string jsonString = JsonSerializer.Serialize(batch, new JsonSerializerOptions
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
                _cancellationTokenSource.Token);

            Console.WriteLine($"Sent batch of {batch.Count} points ({messageBodyBytes.Length} bytes) to RabbitMQ");
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("Batch sending was cancelled");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending batch to RabbitMQ: {ex}");
            throw;
        }
    }

    private static int EstimateTickSize(object tick)
    {
        return 600;
    }

    public async Task ForceFlush(int sessionId = 1)
    {
        if (_disposed) return;
        
        Console.WriteLine("Force flushing remaining data...");
        await FlushBuffer(sessionId);
        Console.WriteLine("Force flush completed");
    }

    public void Dispose()
    {
        if (_disposed) return;
        
        _disposed = true;
        
        Console.WriteLine("Starting BufferedPubSub disposal...");
        
        _cancellationTokenSource.Cancel();
        
        try
        {
            _flushTimer?.Dispose();
            Console.WriteLine("Timer disposed");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error disposing timer: {ex.Message}");
        }
        
        try
        {
            var flushTask = ForceFlush();
            if (flushTask.Wait(TimeSpan.FromSeconds(3)))
            {
                Console.WriteLine("Final flush completed successfully");
            }
            else
            {
                Console.WriteLine("Final flush timed out");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during final flush: {ex.Message}");
        }
        
        lock (_lockObject)
        {
            try
            {
                _channel?.CloseAsync().Wait(TimeSpan.FromSeconds(2));
                _channel?.Dispose();
                Console.WriteLine("Channel closed and disposed");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error disposing channel: {ex.Message}");
            }
            
            try
            {
                _connection?.CloseAsync().Wait(TimeSpan.FromSeconds(2));
                _connection?.Dispose();
                Console.WriteLine("Connection closed and disposed");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error disposing connection: {ex.Message}");
            }
            
            _isConnected = false;
        }
        
        try
        {
            _cancellationTokenSource.Dispose();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error disposing cancellation token source: {ex.Message}");
        }
        
        Console.WriteLine($"BufferedPubSub disposed. Final stats: {_totalPointsBuffered} points, {_totalBatchesSent} batches");
    }
}