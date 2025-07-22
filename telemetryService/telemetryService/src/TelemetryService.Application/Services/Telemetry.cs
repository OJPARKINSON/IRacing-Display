using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using TelemetryService.Domain.Models;

namespace TelemetryService.Application.Services;

public class Telemetry
{
    private static readonly JsonSerializerSettings JsonSettings = new()
    {
        NullValueHandling = NullValueHandling.Ignore,
        MissingMemberHandling = MissingMemberHandling.Ignore,
        ContractResolver = new DefaultContractResolver
        {
            NamingStrategy = new SnakeCaseNamingStrategy()
        }
    };

    public List<TelemetryData> Parse(string input)
    {
        var results = new List<TelemetryData>();

        if (string.IsNullOrWhiteSpace(input))
        {
            return results;
        }

        try
        {
            if (input.TrimStart().StartsWith("[") && input.TrimEnd().EndsWith("]"))
            {
                var dataArray = JsonConvert.DeserializeObject<List<TelemetryData>>(input, JsonSettings);
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
                    var data = JsonConvert.DeserializeObject<TelemetryData>(json, JsonSettings);
                    if (data != null)
                    {
                        Console.WriteLine($"DEBUG: Parsed lap_id: '{data.Lap_id}', session_id: '{data.Session_id}'");
                        results.Add(data);
                    }
                }
                catch (JsonException ex)
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

        if (string.IsNullOrWhiteSpace(input))
        {
            return jsonObjects;
        }

        jsonObjects.Capacity = Math.Max(10, input.Length / 500);
        var depth = 0;
        var startIndex = 0;
        var trimmedInput = input.Trim();

        // Remove array brackets if present
        if (trimmedInput.StartsWith("[") && trimmedInput.EndsWith("]"))
        {
            trimmedInput = trimmedInput.Substring(1, trimmedInput.Length - 2);
        }

        for (var i = 0; i < trimmedInput.Length; i++)
        {
            var c = trimmedInput[i];

            if (c == '{')
            {
                if (depth == 0) startIndex = i;
                depth++;
            }
            else if (c == '}')
            {
                depth--;
                if (depth == 0)
                {
                    jsonObjects.Add(trimmedInput.Substring(startIndex, i - startIndex + 1));
                }
            }
        }

        return jsonObjects;
    }
}