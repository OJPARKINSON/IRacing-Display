using Confluent.Kafka;
using System.Net;

Console.WriteLine("Hello, World!");


using StreamReader reader = new("../ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt");
string text = await reader.ReadToEndAsync();

Console.WriteLine(text.Length);

var config = new ProducerConfig
{
    BootstrapServers = "localhost:9092,localhost:9094,localhost:9095", 
    BrokerAddressFamily = BrokerAddressFamily.V4,
    QueueBufferingMaxMessages = 10,
    SecurityProtocol = SecurityProtocol.Plaintext
};

using (var p = new ProducerBuilder<Null, string>(config).Build())
{
    try
    {
        var dr = await p.ProduceAsync("test-topic", new Message<Null, string> { Value = "test" });
        Console.WriteLine($"Delivered '{dr.Value}' to '{dr.TopicPartitionOffset}'");
    }
    catch (ProduceException<Null, string> e)
    {
        Console.WriteLine($"Delivery failed: {e.Error.Reason}");
    }
}