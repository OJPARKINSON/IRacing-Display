using Confluent.Kafka;
using System.Text;

class PubSubPOC
{
    static async Task Main(string[] args)
    {
        if (args.Length > 0 && args[0].ToLower() == "producer")
        {
            await RunProducer();
        }
        else if (args.Length > 0 && args[0].ToLower() == "consumer")
        {
            RunConsumer();
        }
        else
        {
            Console.WriteLine("Please specify producer or consumer topic");
        }
    }

    static async Task RunProducer()
    {
        string filePath = "../ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt";
        var fileInfo = new FileInfo(filePath);
        Console.WriteLine($"File Size: {fileInfo.Length} bytes");

        byte[] fileBytes = File.ReadAllBytes(filePath);
        Console.WriteLine($"File Bytes: {fileBytes.Length} bytes");
        
        int chunkSize = 1024 * 1024;
        int totalChunks = (int)Math.Ceiling((double)fileBytes.Length / chunkSize);

        var config = new ProducerConfig
        {
            BootstrapServers = "localhost:9092,localhost:9094,localhost:9095",
            BrokerAddressFamily = BrokerAddressFamily.V4,
            QueueBufferingMaxMessages = 10,
            SecurityProtocol = SecurityProtocol.Plaintext,
            MessageMaxBytes = 209715200,
            MessageCopyMaxBytes = 209715200,
            MessageTimeoutMs = 600000,
            QueueBufferingMaxKbytes = 209715200,
            SocketReceiveBufferBytes = 90000000
        };

        using (var p = new ProducerBuilder<string, byte[]>(config).Build())
        {
            Console.WriteLine($"Sending file in {totalChunks} chunks");
            
            var startTime = DateTime.UtcNow;

            for (int chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++)
            {
                int startPos = chunkIndex * chunkSize;
                int chunkLength = Math.Min(chunkSize, fileBytes.Length - startPos);

                byte[] chunk = new byte[chunkLength];
                Array.Copy(fileBytes, startPos, chunk, 0, chunkLength);

                var headers = new Headers();
                headers.Add("filename", Encoding.UTF8.GetBytes(Path.GetFileName(filePath)));
                headers.Add("chunkIndex", Encoding.UTF8.GetBytes(chunkIndex.ToString()));
                headers.Add("totalChunks", Encoding.UTF8.GetBytes(totalChunks.ToString()));
                headers.Add("fileSize", Encoding.UTF8.GetBytes(fileBytes.Length.ToString()));
                headers.Add("transferId", Encoding.UTF8.GetBytes($"{Path.GetFileName(filePath)}-{startTime}"));

                try
                {
                    string key = Path.GetFileName(filePath);
                    Console.WriteLine(chunk.Length);
                    var dr = await p.ProduceAsync("large-files",
                        new Message<string, byte[]> { Key = key, Value = chunk, Headers = headers,});

                    Console.WriteLine($"Delivered {chunkIndex + 1}/{totalChunks} to {dr.TopicPartitionOffset}");
                }
                catch (ProduceException<string, byte[]> e)
                {
                    Console.WriteLine($"Delivery failed: {e.Error.Reason}");
                }
            }

            p.Flush(TimeSpan.FromSeconds(10));
            Console.WriteLine("File transfer complete");
        }
    }

    static async Task RunConsumer()
    {
        Console.WriteLine("Starting consumer");
    }
}