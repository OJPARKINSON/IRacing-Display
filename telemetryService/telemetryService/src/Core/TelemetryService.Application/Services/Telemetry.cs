using Newtonsoft.Json;
using TelemetryService.Domain.Models;

namespace TelemetryService.Application.Services;

public class Telemetry
{
    private static readonly JsonSerializerSettings JsonSettings = new()
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
                try
                {
                    var data = JsonConvert.DeserializeObject<TelemetryData>(json, JsonSettings);
                    if (data != null) results.Add(data);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error parsing JSON: {ex.Message}");
                    Console.WriteLine($"Problematic JSON: {json.Substring(0, Math.Min(100, json.Length))}...");
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
        jsonObjects.Capacity = Math.Max(10, input.Length / 500);
        var depth = 0;
        var startIndex = 0;

        if (input.TrimStart().StartsWith("[") && input.TrimEnd().EndsWith("]"))
            input = input.TrimStart().Substring(1, input.TrimEnd().Length - 2);

        for (var i = 0; i < input.Length; i++)
        {
            var c = input[i];

            if (c == '{')
            {
                if (depth == 0) startIndex = i;
                depth++;
            }
            else if (c == '}')
            {
                depth--;
                if (depth == 0) jsonObjects.Add(input.Substring(startIndex, i - startIndex + 1));
            }
        }

        return jsonObjects;
    }
}