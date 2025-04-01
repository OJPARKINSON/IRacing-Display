using System;
using System.Threading.Tasks;
using PubSubPOC.Core.Producer;
using PubSubPOC.Core.Consumer;

namespace PubSubPOC.Core
{
    class Program
    {
        static async Task Main(string[] args)
        {
            if (args.Length > 0 && args[0].ToLower() == "producer")
            {
                await RunProducer();
            }
            else if (args.Length > 0 && args[0].ToLower() == "consumer")
            {
                await RunConsumer();
            }
            else
            {
                Console.WriteLine("Please specify producer or consumer topic");
            }
        }

        static async Task RunProducer()
        {
            string filePath = "../ibt_files/mclaren720sgt3_monza full 2025-02-09 12-58-11.ibt";
            var fileProducer = new FileProducer();
            await fileProducer.SendFile(filePath);
        }

        static async Task RunConsumer()
        {
            Console.WriteLine("Starting consumer");
            var fileConsumer = new FileConsumer();
            await fileConsumer.StartConsuming();
        }
    }
}