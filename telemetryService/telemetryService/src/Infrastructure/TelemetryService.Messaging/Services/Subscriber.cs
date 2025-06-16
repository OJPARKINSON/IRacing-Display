using System.Text;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TelemetryService.Application.Services;
using TelemetryService.Domain.Models;
using TelemetryService.Persistence.Services;

namespace TelemetryService.Messaging.Services;

public class Subscriber

{
    private const int MaxRetryAttempts = 10;
    private const int RetryDelayMs = 5000;
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

        while (!connected && retryCount < MaxRetryAttempts)
            try
            {
                Console.WriteLine($"Connecting to RabbitMQ (Attempt {retryCount + 1}/{MaxRetryAttempts})...");
                await ConnectAndSubscribeAsync();
                connected = true;
            }
            catch (Exception ex)
            {
                retryCount++;
                Console.WriteLine($"Failed to connect to RabbitMQ: {ex.Message}");
                Console.WriteLine($"Exception details: {ex}");
                Console.WriteLine($"Retrying in {RetryDelayMs / 1000} seconds...");
                await Task.Delay(RetryDelayMs);
            }

        if (!connected) Console.WriteLine("Failed to connect to RabbitMQ after multiple attempts. Exiting.");
    }

    private async Task ConnectAndSubscribeAsync()
    {
        var factory = new ConnectionFactory
        {
            // Potentially need to use localhost when running locally
            HostName = "rabbitmq",
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
        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);

                List<TelemetryData> telemetryData = _telemetryService.Parse(message);


                bool alreadyExist =
                    _influxService.CheckIfAlreadyExists(telemetryData[0].Track_name, telemetryData[0].Session_id);

                if (!alreadyExist)
                {
                    await _influxService.WriteTicks(telemetryData);
                    Console.WriteLine($"Successfully processed {telemetryData.Count} telemetry points");
                }
                else
                {
                    Console.WriteLine($"Session already existis");
                }

                
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