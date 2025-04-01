using Confluent.Kafka;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using PubSubPOC.Core.Utilities;
using System.Security.Cryptography;

namespace PubSubPOC.Core.Consumer
{
    public class FileConsumer
    {
        private readonly ConsumerConfig _config;
        private const string FileTopicName = "large-files";
        private const string TestTopicName = "test-topic";
        private readonly Dictionary<string, FileReassembly> _fileReassemblers = new Dictionary<string, FileReassembly>();
        private readonly object _reassemblyLock = new object();
        private readonly CancellationTokenSource _cleanupCts = new CancellationTokenSource();
        private readonly string _publicKeyPath;
        private readonly bool _enableVerification;

        public FileConsumer(bool enableVerification = true)
        {
            _config = new ConsumerConfig
            {
                BootstrapServers = "localhost:9092,localhost:9094,localhost:9095",
                GroupId = "file-processor-group",
                AutoOffsetReset = AutoOffsetReset.Earliest,
                EnableAutoCommit = false,
                FetchMaxBytes = 409715200,
                MaxPartitionFetchBytes = 409715200,
                SecurityProtocol = SecurityProtocol.Plaintext
            };

            _enableVerification = enableVerification;
            _publicKeyPath = Path.Combine(Environment.CurrentDirectory, "keys", "producer_public.key");

            if (_enableVerification && !File.Exists(_publicKeyPath))
            {
                Console.WriteLine($"WARNING: Public key not found at {_publicKeyPath}");
                Console.WriteLine("Signature verification will be disabled. Obtain the producer's public key.");
                _enableVerification = false;
            }
        }

        public async Task StartConsuming(CancellationToken cancellationToken = default)
        {
            Task cleanupTask = CleanupStaleTransfersAsync(_cleanupCts.Token);

            using (var consumer = new ConsumerBuilder<string, byte[]>(_config).Build())
            {
                consumer.Subscribe(new List<string> { FileTopicName, TestTopicName });
                Console.WriteLine($"Subscribed to topics: {FileTopicName}, {TestTopicName}");

                try
                {
                    while (!cancellationToken.IsCancellationRequested)
                    {
                        try
                        {
                            ConsumeResult<string, byte[]> consumeResult = consumer.Consume(TimeSpan.FromSeconds(10));
                            
                            if (consumeResult == null)
                                continue;

                            if (consumeResult.Topic == FileTopicName)
                            {
                                await ProcessFileChunk(consumeResult);
                            }
                            else
                            {
                                ProcessTestEvent(consumeResult);
                            }

                            consumer.Commit(consumeResult);
                        }
                        catch (ConsumeException e)
                        {
                            Console.WriteLine($"Consume error: {e.Error.Reason}");
                        }
                        catch (OperationCanceledException)
                        {
                            break;
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Consumer error: {ex.Message}");
                        }
                    }
                }
                finally
                {
                    consumer.Close();
                    _cleanupCts.Cancel();
                    await cleanupTask;
                }
            }
        }

        private async Task ProcessFileChunk(ConsumeResult<string, byte[]> consumeResult)
        {
            try
            {
                string filename = null;
                string transferId = null;
                int chunkIndex = -1;
                int totalChunks = 0;
                int fileSize = 0;
                string fileHash = null;
                byte[] signature = null;
                string signatureAlgorithm = null;
                bool parseError = false;

                foreach (var header in consumeResult.Message.Headers)
                {
                    switch (header.Key)
                    {
                        case "filename":
                            filename = Encoding.UTF8.GetString(header.GetValueBytes());
                            break;
                        case "chunkIndex":
                            if (!int.TryParse(Encoding.UTF8.GetString(header.GetValueBytes()), out chunkIndex))
                            {
                                Console.WriteLine("Invalid chunkIndex");
                                parseError = true;
                            }
                            break;
                        case "totalChunks":
                            if (!int.TryParse(Encoding.UTF8.GetString(header.GetValueBytes()), out totalChunks))
                            {
                                Console.WriteLine("Invalid totalChunks");
                                parseError = true;
                            }
                            break;
                        case "fileSize":
                            if (!int.TryParse(Encoding.UTF8.GetString(header.GetValueBytes()), out fileSize))
                            {
                                Console.WriteLine("Invalid fileSize");
                                parseError = true;
                            }
                            break;
                        case "transferId":
                            transferId = Encoding.UTF8.GetString(header.GetValueBytes());
                            break;
                        case "fileHash":
                            fileHash = Encoding.UTF8.GetString(header.GetValueBytes());
                            break;
                        case "signature":
                            signature = header.GetValueBytes();
                            break;
                        case "signatureAlgorithm":
                            signatureAlgorithm = Encoding.UTF8.GetString(header.GetValueBytes());
                            break;
                    }
                }

                if (string.IsNullOrEmpty(filename) || string.IsNullOrEmpty(transferId) || parseError)
                {
                    Console.WriteLine("Received chunk with missing or invalid metadata, skipping");
                    return;
                }
                
                if (chunkIndex < 0 || chunkIndex >= totalChunks)
                {
                    Console.WriteLine($"Invalid chunk index {chunkIndex} (total chunks: {totalChunks}), skipping");
                    return;
                }

                FileReassembly reassembly;
                lock (_reassemblyLock)
                {
                    if (!_fileReassemblers.TryGetValue(transferId, out reassembly))
                    {
                        reassembly = new FileReassembly
                        {
                            Filename = filename,
                            TotalChunks = totalChunks,
                            ReceivedChunks = new Dictionary<int, byte[]>(),
                            TotalFileSize = fileSize,
                            TransferId = transferId,
                            LastUpdated = DateTime.UtcNow,
                            FileHash = fileHash,
                            Signature = signature,
                            SignatureAlgorithm = signatureAlgorithm
                        };
                        _fileReassemblers.Add(transferId, reassembly);
                    }
                    else
                    {
                        if (reassembly.TotalChunks != totalChunks)
                        {
                            Console.WriteLine($"Warning: Chunk has inconsistent totalChunks value: got {totalChunks}, expected {reassembly.TotalChunks}");
                        }

                        if (chunkIndex == 0 && reassembly.Signature == null && signature != null)
                        {
                            reassembly.Signature = signature;
                            reassembly.SignatureAlgorithm = signatureAlgorithm;
                        }
                    }
                }

                bool isComplete = false;
                
                lock (reassembly.Lock)
                {
                    if (reassembly.ReceivedChunks.ContainsKey(chunkIndex))
                    {
                        Console.WriteLine($"Duplicate chunk received for index {chunkIndex}, overwriting");
                    }
                    
                    reassembly.ReceivedChunks[chunkIndex] = consumeResult.Message.Value;
                    reassembly.LastUpdated = DateTime.UtcNow;

                    Console.WriteLine($"Processed chunk {chunkIndex + 1}/{totalChunks} for file {filename} (Transfer ID: {transferId}, Received: {reassembly.ReceivedChunks.Count}/{totalChunks})");

                    isComplete = reassembly.ReceivedChunks.Count == reassembly.TotalChunks;
                    
                    if (!isComplete)
                    {
                        int progress = (int)Math.Ceiling((reassembly.ReceivedChunks.Count / (double)reassembly.TotalChunks) * 100);
                        ConsoleUtility.WriteProgressBar(progress, reassembly.ReceivedChunks.Count > 1);
                    }
                }
                
                if (isComplete)
                {
                    Console.WriteLine($"All chunks received for file {filename}, reassembling...");
                    await ReassembleAndSaveFileAsync(reassembly);
                    lock (_reassemblyLock)
                    {
                        _fileReassemblers.Remove(transferId);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error processing file chunk: {ex.Message}");
            }
        }

        private async Task ReassembleAndSaveFileAsync(FileReassembly reassembly)
        {
            try
            {
                using (var completeFileStream = new MemoryStream(reassembly.TotalFileSize))
                {
                    for (int i = 0; i < reassembly.TotalChunks; i++)
                    {
                        if (!reassembly.ReceivedChunks.TryGetValue(i, out byte[] chunkData))
                        {
                            Console.WriteLine($"Missing chunk {i} for file {reassembly.Filename}, cannot reassemble");
                            return;
                        }
                        await completeFileStream.WriteAsync(chunkData, 0, chunkData.Length);
                    }
                    
                    if (completeFileStream.Length != reassembly.TotalFileSize)
                    {
                        Console.WriteLine($"Reassembled file size mismatch: expected {reassembly.TotalFileSize}, got {completeFileStream.Length}");
                        return;
                    }

                    byte[] fileData = completeFileStream.ToArray();

                    if (!string.IsNullOrEmpty(reassembly.FileHash))
                    {
                        byte[] actualHashBytes;
                        using (var sha256 = SHA256.Create())
                        {
                            actualHashBytes = sha256.ComputeHash(fileData);
                        }
                        string actualHash = Convert.ToBase64String(actualHashBytes);
                        
                        if (actualHash != reassembly.FileHash)
                        {
                            Console.WriteLine($"File hash verification failed!");
                            Console.WriteLine($"Expected: {reassembly.FileHash}");
                            Console.WriteLine($"Actual: {actualHash}");
                            return;
                        }
                        
                        Console.WriteLine("SHA-256 hash verification successful");
                        
                        if (_enableVerification && reassembly.Signature != null && 
                            "ED25519-SHA256".Equals(reassembly.SignatureAlgorithm, StringComparison.OrdinalIgnoreCase))
                        {
                            try
                            {
                                byte[] fileHashBytes = Convert.FromBase64String(reassembly.FileHash);

                                bool isSignatureValid;
                                
                                using (var ecdsa = ECDsa.Create())
                                {
                                    byte[] publicKeyBytes = File.ReadAllBytes(_publicKeyPath);
                                    ecdsa.ImportSubjectPublicKeyInfo(publicKeyBytes, out _);
                
                                    isSignatureValid =  ecdsa.VerifyData(fileHashBytes, reassembly.Signature, HashAlgorithmName.SHA256);
                                }
                                
                                if (!isSignatureValid)
                                {
                                    Console.WriteLine("Digital signature verification failed! The file may have been tampered with or came from an unauthorized source.");
                                    Console.WriteLine("WARNING: Saving file despite failed signature verification.");
                                }
                                else
                                {
                                    Console.WriteLine("Digital signature verification successful - file is authentic");
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Error verifying digital signature: {ex.Message}");
                            }
                        }
                    }
                    
                    string outputDir = Path.Combine(Environment.CurrentDirectory, "received_files");
                    Directory.CreateDirectory(outputDir);

                    string outputPath = Path.Combine(outputDir, reassembly.Filename);
                    using (var fileStream = new FileStream(outputPath, FileMode.Create, FileAccess.Write))
                    {
                        completeFileStream.Position = 0;
                        await completeFileStream.CopyToAsync(fileStream);
                    }

                    Console.WriteLine($"Successfully reassembled file {reassembly.Filename} from {reassembly.TotalChunks} chunks ({completeFileStream.Length} bytes)");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to save file {reassembly.Filename}: {ex.Message}");
            }
        }

        private async Task CleanupStaleTransfersAsync(CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromMinutes(5), cancellationToken);

                    DateTime now = DateTime.UtcNow;
                    List<string> staleTransferIds = new List<string>();

                    lock (_reassemblyLock)
                    {
                        foreach (var entry in _fileReassemblers)
                        {
                            if ((now - entry.Value.LastUpdated).TotalMinutes > 30)
                            {
                                Console.WriteLine($"Cleaning up stale transfer {entry.Key} for file {entry.Value.Filename}");
                                staleTransferIds.Add(entry.Key);
                            }
                        }

                        foreach (string id in staleTransferIds)
                        {
                            _fileReassemblers.Remove(id);
                        }
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Normal exit due to cancellation
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in cleanup task: {ex.Message}");
            }
        }

        private void ProcessTestEvent(ConsumeResult<string, byte[]> consumeResult)
        {
            Console.WriteLine($"Key: {consumeResult.Message.Key}");
            Console.WriteLine($"Topic Partition: {consumeResult.TopicPartition}");
            Console.WriteLine($"Value: {Encoding.UTF8.GetString(consumeResult.Message.Value)}");
            
            Console.WriteLine("Headers:");
            foreach (var header in consumeResult.Message.Headers)
            {
                Console.WriteLine($"  {header.Key}: {Encoding.UTF8.GetString(header.GetValueBytes())}");
            }
        }

        private class FileReassembly
        {
            public string TransferId { get; set; }
            public string Filename { get; set; }
            public int TotalChunks { get; set; }
            public Dictionary<int, byte[]> ReceivedChunks { get; set; }
            public int TotalFileSize { get; set; }
            public DateTime LastUpdated { get; set; }
            public string FileHash { get; set; }
            public byte[] Signature { get; set; }
            public string SignatureAlgorithm { get; set; }
            public object Lock { get; } = new object();
        }
    }
}