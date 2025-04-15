using System.Text;
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
            var results = new List<TelemetryData>();
            
            try
            {
                if (input.TrimStart().StartsWith("[") && input.TrimEnd().EndsWith("]"))
                {
                    Console.WriteLine("Parsing input as JSON array");
                    var dataArray = JsonConvert.DeserializeObject<List<TelemetryData>>(input, _jsonSettings);
                    if (dataArray != null && dataArray.Count > 0)
                    {
                        Console.WriteLine($"Successfully parsed {dataArray.Count} data points from JSON array");
                        return dataArray;
                    }
                }
                
                Console.WriteLine("Falling back to JSON object parsing");
                var jsonArr = SplitString(input);
                results.Capacity = jsonArr.Count;
                
                foreach (var json in jsonArr)
                {
                    try
                    {
                        var data = JsonConvert.DeserializeObject<TelemetryData>(json, _jsonSettings);
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
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in Parse method: {ex.Message}");
                Console.WriteLine($"Input: {input.Substring(0, Math.Min(100, input.Length))}...");
            }

            return results;
        }
        
        public List<string> SplitString(string input)
        {
            var jsonObjects = new List<string>();
            jsonObjects.Capacity = Math.Max(10, input.Length/500);
            int depth = 0;
            int startIndex = 0;
            
            if (input.TrimStart().StartsWith("[") && input.TrimEnd().EndsWith("]"))
            {
                input = input.TrimStart().Substring(1, input.TrimEnd().Length - 2);
            }
            
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
}