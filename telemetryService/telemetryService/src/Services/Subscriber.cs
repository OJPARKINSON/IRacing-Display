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

        public Subscriber(Telemetry telemetryService, InfluxService influxService)
        {
            _telemetryService = telemetryService;
            _influxService = influxService;
        }
        
       public async Task  SubscribeAsync()
       {
           var factory = new ConnectionFactory
           {
               HostName = "rabbitMQ",
               Port = 5672,
               UserName = "guest",
               Password = "guest",
               RequestedHeartbeat = TimeSpan.FromSeconds(30),
               AutomaticRecoveryEnabled = true,
               NetworkRecoveryInterval = TimeSpan.FromSeconds(10),
           };
           using var connection = await factory.CreateConnectionAsync();
           using var channel = await connection.CreateChannelAsync();
           
           
           await channel.ExchangeDeclareAsync(exchange: "telemetry_topic", type: ExchangeType.Topic, durable: true, autoDelete: false);
           
           QueueDeclareOk queueDeclareResult = await channel.QueueDeclareAsync();
           string queueName = queueDeclareResult.QueueName;
           await channel.QueueBindAsync(queue: queueName, exchange: "telemetry_topic", routingKey: "telemetry.*");

           Console.WriteLine(" [*] Waiting for logs.");

           var consumer = new AsyncEventingBasicConsumer(channel);
           consumer.ReceivedAsync += async (model, ea) =>
           {
               try
               {
                   byte[] body = ea.Body.ToArray();
                   string message = Encoding.UTF8.GetString(body);
                    
                   Console.WriteLine($" [x] Received telemetry data: {message.Substring(0, Math.Min(100, message.Length))}...");
                    
                   List<TelemetryData> telemetryData = _telemetryService.Parse(message);
                    
                   await _influxService.WriteTicks(telemetryData);
                    
                   Console.WriteLine($" [x] Successfully processed {telemetryData.Count} telemetry points");
               }
               catch (Exception ex)
               {
                   Console.WriteLine($" [!] Error processing message: {ex.Message}");
               }

           };

           await channel.BasicConsumeAsync(queueName, autoAck: true, consumer: consumer);

           Console.WriteLine(" Press [enter] to exit.");
           Console.ReadLine();

       }
    }
}