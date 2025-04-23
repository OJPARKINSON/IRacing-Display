using System.Text;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TelemetryService.Models;

namespace TelemetryService.Services.Subscriber
{
    class Subscriber
    {
        private readonly Telemetry _telemetryService;
        private readonly InfluxService _influxService;
        private const int MAX_RETRY_ATTEMPTS = 10;
        private const int RETRY_DELAY_MS = 5000;

        public Subscriber(Telemetry telemetryService, InfluxService influxService)
        {
            _telemetryService = telemetryService;
            _influxService = influxService;
        }
        
        public async Task SubscribeAsync()
        {
            int retryCount = 0;
            bool connected = false;
            
            while (!connected && retryCount < MAX_RETRY_ATTEMPTS)
            {
                try
                {
                    Console.WriteLine($"Connecting to RabbitMQ (Attempt {retryCount + 1}/{MAX_RETRY_ATTEMPTS})...");
                    await ConnectAndSubscribeAsync();
                    connected = true;
                }
                catch (Exception ex)
                {
                    retryCount++;
                    Console.WriteLine($"Failed to connect to RabbitMQ: {ex.Message}");
                    Console.WriteLine($"Exception details: {ex}");
                    Console.WriteLine($"Retrying in {RETRY_DELAY_MS/1000} seconds...");
                    await Task.Delay(RETRY_DELAY_MS);
                }
            }
            
            if (!connected)
            {
                Console.WriteLine("Failed to connect to RabbitMQ after multiple attempts. Exiting.");
            }
        }
        
        private async Task ConnectAndSubscribeAsync()
        {
            var factory = new ConnectionFactory
            {
                HostName = "rabbitMQ",
                Port = 5672,
                UserName = "guest",
                Password = "guest",
                RequestedHeartbeat = TimeSpan.FromSeconds(30),
                AutomaticRecoveryEnabled = true,
                NetworkRecoveryInterval = TimeSpan.FromSeconds(10)
            };
            
            Console.WriteLine($"Connecting to RabbitMQ at {factory.HostName}:{factory.Port} with user {factory.UserName}");
            
            using var connection = await factory.CreateConnectionAsync();
            Console.WriteLine("Successfully connected to RabbitMQ!");
            
            using var channel = await connection.CreateChannelAsync();
            Console.WriteLine("Channel created successfully");
            
            // Make sure both exchange types match in both applications
            await channel.ExchangeDeclareAsync(
                exchange: "telemetry_topic", 
                type: ExchangeType.Topic, 
                durable: true, 
                autoDelete: false);
            Console.WriteLine("Exchange declared successfully");
            
            // Make sure the queue name and properties match the Go publisher exactly
            await channel.QueueDeclareAsync(
                queue: "telemetry_queue",
                durable: true,
                exclusive: false,
                autoDelete: false);
            Console.WriteLine("Queue declared successfully");
            
            // Bind to specific routing key from Go
            await channel.QueueBindAsync(
                queue: "telemetry_queue",
                exchange: "telemetry_topic",
                routingKey: "telemetry.ticks");
            Console.WriteLine("Queue bound to exchange with routing key telemetry.ticks");
            
            Console.WriteLine("Waiting for messages...");

            var consumer = new AsyncEventingBasicConsumer(channel);
            consumer.ReceivedAsync += async (model, ea) =>
            {
                try
                {
                    byte[] body = ea.Body.ToArray();
                    string message = Encoding.UTF8.GetString(body);
                    
                    List<TelemetryData> telemetryData = _telemetryService.Parse(message);
                    
                    await _influxService.WriteTicks(telemetryData);
                    Console.WriteLine($"Successfully processed {telemetryData.Count} telemetry points");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error processing message: {ex.Message}");
                    Console.WriteLine($"Exception details: {ex}");
                }
            };

            await channel.BasicConsumeAsync(
                queue: "telemetry_queue",
                autoAck: true,
                consumer: consumer);

            Console.WriteLine("Consumer registered. Waiting for messages...");
            
            // Keep the connection alive
            await Task.Delay(Timeout.Infinite);
        }
    }
}