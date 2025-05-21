using System.Text;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TelemetryService.Models;

namespace TelemetryService.Services.Subscriber;

internal class Subscriber
{
    private const int MAX_RETRY_ATTEMPTS = 10;
    private const int RETRY_DELAY_MS = 5000;
    private readonly InfluxService _influxService;
    private readonly Telemetry _telemetryService;

    public Subscriber(Telemetry telemetryService, InfluxService influxService)
    {
        _telemetryService = telemetryService;
        _influxService = influxService;
    }

    public async Task SubscribeAsync()
    {
        var retryCount = 0;
        var connected = false;

        while (!connected && retryCount < MAX_RETRY_ATTEMPTS)
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
                Console.WriteLine($"Retrying in {RETRY_DELAY_MS / 1000} seconds...");
                await Task.Delay(RETRY_DELAY_MS);
            }

        if (!connected) Console.WriteLine("Failed to connect to RabbitMQ after multiple attempts. Exiting.");
    }

    private async Task ConnectAndSubscribeAsync()
    {
        string? env = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
        if (env == "Production")
        {
            env = "rabbitmq";
        }
        else
        {
            env = "localhost";
        }
        var factory = new ConnectionFactory
        {
            HostName = env,
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

        await channel.ExchangeDeclareAsync(
            "telemetry_topic",
            ExchangeType.Topic,
            true,
            false);
        Console.WriteLine("Exchange declared successfully");

        await channel.QueueDeclareAsync(
            "telemetry_queue",
            true,
            false,
            false);
        Console.WriteLine("Queue declared successfully");

        await channel.QueueBindAsync(
            "telemetry_queue",
            "telemetry_topic",
            "telemetry.ticks");
        Console.WriteLine("Queue bound to exchange with routing key telemetry.ticks");

        Console.WriteLine("Waiting for messages...");

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (model, ea) =>
        {
            try
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);

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
            "telemetry_queue",
            true,
            consumer);

        Console.WriteLine("Consumer registered. Waiting for messages...");

        // Keep the connection alive
        await Task.Delay(Timeout.Infinite);
    }
}