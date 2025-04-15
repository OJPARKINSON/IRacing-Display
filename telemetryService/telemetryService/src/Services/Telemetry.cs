using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.ObjectPool;
using Newtonsoft.Json;
using TelemetryService.Models;

namespace TelemetryService.Services
{
    class Telemetry
    {
        private static readonly JsonSerializerSettings _jsonSettings = new JsonSerializerSettings
        {
            NullValueHandling = NullValueHandling.Ignore,
            MissingMemberHandling = MissingMemberHandling.Ignore
        };
        public List<TelemetryData> Parse(string input)
        {
            var jsonArr = SplitString(input);
            var results = new List<TelemetryData>();
            results.Capacity = jsonArr.Count;
            
            foreach (var json in jsonArr)
            {
                try
                {
                    var data = Newtonsoft.Json.JsonConvert.DeserializeObject<TelemetryData>(json, _jsonSettings);
                    if (data != null)
                    {
                        results.Add(data);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error parsing JSON: {ex.Message}");
                    Console.WriteLine($"Problematic JSON: {json.Substring(0, Math.Min(100, json.Length))}...");
                }
            }

            return results;
        }
        
        public List<string> SplitString(string input)
        {
            var jsonObjects = new List<string>();
            jsonObjects.Capacity = Math.Max(10, input.Length/500);
            int depth = 0;
            int startIndex = 0;
            for (int i = 0; i < input.Length; i++)
            {
                char c = input[i];
                
                if (c == '{')
                {
                    if (depth == 0)
                    {
                        startIndex = i;
                    }
                    depth++;
                }
                else if (c == '}')
                {
                    depth--;
                    if (depth == 0)
                    {
                        jsonObjects.Add(input.Substring(startIndex, i - startIndex + 1));
                    }
                }
            }

            return jsonObjects;
        }
    }
};

