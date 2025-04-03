using Confluent.Kafka;
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using PubSubPOC.Core.Utilities;
using System.Security.Cryptography;

namespace PubSubPOC.Core.Producer
{
    public class FileProducer
    {
        private readonly ProducerConfig _config;
        private const int ChunkSize = 1024 * 1024; // 1MB chunks
        private const string TopicName = "large-files";
        private readonly string _privateKeyPath;
        private readonly bool _enableSigning;

        public FileProducer()
        {
            _config = new ProducerConfig
            {
                BootstrapServers = "localhost:9092,localhost:9094",
                BrokerAddressFamily = BrokerAddressFamily.V4,
                QueueBufferingMaxMessages = 10,
                SecurityProtocol = SecurityProtocol.Plaintext,
                MessageMaxBytes = 209715200,
                MessageCopyMaxBytes = 209715200,
                MessageTimeoutMs = 600000,
                QueueBufferingMaxKbytes = 209715200,
                SocketReceiveBufferBytes = 90000000
            };
            _privateKeyPath = Path.Combine(Environment.CurrentDirectory, "keys", "producer_private.key");

            if (!File.Exists(_privateKeyPath))
            {
                Console.WriteLine($"WARNING: Private key not found at {_privateKeyPath}");
                Console.WriteLine("Digital signatures will be disabled. Run the KeyGenerator tool to create keys.");
                _enableSigning = false;
            }
        }

        public async Task SendFile(string filePath)
        {
            var fileInfo = new FileInfo(filePath);
            Console.WriteLine($"File Size: {fileInfo.Length} bytes");

            byte[] fileBytes = File.ReadAllBytes(filePath);
            Console.WriteLine($"File Bytes: {fileBytes.Length} bytes");

            byte[] fileHash;

            using (var sha256 = SHA256.Create())
            {
                fileHash = sha256.ComputeHash(fileBytes);
            }

            string fileHashBase64 = Convert.ToBase64String(fileHash);

            byte[] signature = null;
            if (_enableSigning)
            {
                try
                {
                    using (var ecdsa = ECDsa.Create())
                    {
                        byte[] privateKeyBytes = File.ReadAllBytes(_privateKeyPath);
                        ecdsa.ImportECPrivateKey(privateKeyBytes, out _);

                        signature = ecdsa.SignData(fileHash, HashAlgorithmName.SHA256);
                        Console.WriteLine("File signed successfully with ED25519");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error signing file: {ex.Message}");
                    Console.WriteLine("Continuing without digital signature");
                }
            }

            int totalChunks = (int)Math.Ceiling((double)fileBytes.Length / ChunkSize);
            var startTime = DateTime.UtcNow;

            using (var producer = new ProducerBuilder<string, byte[]>(_config).Build())
            {
                Console.WriteLine($"Sending file in {totalChunks} chunks");
                ConsoleUtility.WriteProgressBar(0);

                for (int chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++)
                {
                    await SendChunk(producer, filePath, fileBytes, chunkIndex, totalChunks, startTime, fileHashBase64, signature);

                    int progress = (int)Math.Ceiling((chunkIndex / (double)totalChunks) * 100);
                    ConsoleUtility.WriteProgressBar(progress, true);
                }

                Console.WriteLine();
                producer.Flush(TimeSpan.FromSeconds(10));

                var end = DateTime.UtcNow;
                Console.WriteLine($"Completed in {(end - startTime).TotalMilliseconds}MS");
                Console.WriteLine("File transfer complete");
            }
        }

        private async Task SendChunk(IProducer<string, byte[]> producer, string filePath,
                                    byte[] fileBytes, int chunkIndex, int totalChunks, DateTime startTime, string fileHash, byte[] signature)
        {
            int startPos = chunkIndex * ChunkSize;
            int chunkLength = Math.Min(ChunkSize, fileBytes.Length - startPos);

            byte[] chunk = new byte[chunkLength];
            Array.Copy(fileBytes, startPos, chunk, 0, chunkLength);

            var headers = new Headers
            {
                { "filename", Encoding.UTF8.GetBytes(Path.GetFileName(filePath)) },
                { "chunkIndex", Encoding.UTF8.GetBytes(chunkIndex.ToString()) },
                { "totalChunks", Encoding.UTF8.GetBytes(totalChunks.ToString()) },
                { "fileSize", Encoding.UTF8.GetBytes(fileBytes.Length.ToString()) },
                { "transferId", Encoding.UTF8.GetBytes($"{Path.GetFileName(filePath)}-{startTime}") },
                {"fileHash", Encoding.UTF8.GetBytes(fileHash)}
            };

            if (chunk.Length == 0)
            {
                headers.Add("signature", signature);
            }

            try
            {
                string key = Path.GetFileName(filePath);
                await producer.ProduceAsync(TopicName,
                    new Message<string, byte[]> { Key = key, Value = chunk, Headers = headers });
            }
            catch (ProduceException<string, byte[]> e)
            {
                Console.WriteLine($"Delivery failed: {e.Error.Reason}");
            }
        }
    }
}

