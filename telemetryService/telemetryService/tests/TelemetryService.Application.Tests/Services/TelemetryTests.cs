using FluentAssertions;
using TelemetryService.Application.Services;
using TelemetryService.Domain.Models;
using Xunit;

namespace TelemetryService.Application.Tests.Services;

public class TelemetryTests
{
    private readonly Telemetry _telemetryService;

    public TelemetryTests()
    {
        _telemetryService = new Telemetry();
    }

    [Fact]
    public void Parse_WithValidJsonArray_ShouldReturnTelemetryData()
    {
        // Arrange
        var input = """
        [
            {
                "Car_id": "test_car",
                "Session_id": "test_session",
                "Speed": 100.5,
                "Session_time": 120.0,
                "Brake": 0.0,
                "Throttle": 0.8
            }
        ]
        """;

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().HaveCount(1);
        var telemetryData = result.First();
        telemetryData.Car_id.Should().Be("test_car");
        telemetryData.Session_id.Should().Be("test_session");
        telemetryData.Speed.Should().Be(100.5);
        telemetryData.Session_time.Should().Be(120.0);
    }

    [Fact]
    public void Parse_WithEmptyInput_ShouldReturnEmptyList()
    {
        // Arrange
        var input = "";

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void Parse_WithNullInput_ShouldReturnEmptyList()
    {
        // Arrange
        string input = null!;

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void Parse_WithInvalidJson_ShouldHandleGracefully()
    {
        // Arrange
        var input = "invalid json";

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void Parse_WithMultipleJsonObjects_ShouldParseAll()
    {
        // Arrange
        var input = """
        {"Car_id": "car1", "Session_id": "session1", "Speed": 50.0}
        {"Car_id": "car2", "Session_id": "session2", "Speed": 75.0}
        """;

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(t => t.Car_id == "car1" && t.Speed == 50.0);
        result.Should().Contain(t => t.Car_id == "car2" && t.Speed == 75.0);
    }

    [Theory]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("   ")]
    public void Parse_WithEdgeCases_ShouldHandleGracefully(string input)
    {
        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().NotBeNull();
    }

    [Fact]
    public void Parse_WithValidSingleJsonObject_ShouldParseCorrectly()
    {
        // Arrange
        var input = """
        {
            "Car_id": "single_car",
            "Session_id": "single_session",
            "Speed": 88.5,
            "Rpm": 7500,
            "Gear": 3
        }
        """;

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().HaveCount(1);
        var telemetryData = result.First();
        telemetryData.Car_id.Should().Be("single_car");
        telemetryData.Session_id.Should().Be("single_session");
        telemetryData.Speed.Should().Be(88.5);
        telemetryData.Rpm.Should().Be(7500);
        telemetryData.Gear.Should().Be(3);
    }

    [Fact]
    public void Parse_WithPartiallyValidJsonArray_ShouldParseValidItems()
    {
        // Arrange
        var input = """
        [
            {
                "Car_id": "valid_car",
                "Session_id": "valid_session",
                "Speed": 100.0
            },
            {
                "Car_id": "another_valid_car",
                "Session_id": "another_session",
                "Speed": 85.5
            }
        ]
        """;

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(t => !string.IsNullOrEmpty(t.Car_id));
    }

    [Fact]
    public void SplitString_WithValidJsonObjects_ShouldSplitCorrectly()
    {
        // Arrange
        var input = """{"id": 1}{"id": 2}{"id": 3}""";

        // Act
        var result = _telemetryService.SplitString(input);

        // Assert
        result.Should().HaveCount(3);
        result.Should().Contain("""{"id": 1}""");
        result.Should().Contain("""{"id": 2}""");
        result.Should().Contain("""{"id": 3}""");
    }

    [Fact]
    public void SplitString_WithNestedObjects_ShouldHandleNesting()
    {
        // Arrange
        var input = """{"outer": {"inner": "value1"}}{"simple": "value2"}""";

        // Act
        var result = _telemetryService.SplitString(input);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain("""{"outer": {"inner": "value1"}}""");
        result.Should().Contain("""{"simple": "value2"}""");
    }

    [Fact]
    public void SplitString_WithArrayWrapping_ShouldRemoveArrayBrackets()
    {
        // Arrange
        var input = """[{"id": 1},{"id": 2}]""";

        // Act
        var result = _telemetryService.SplitString(input);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain("""{"id": 1}""");
        result.Should().Contain("""{"id": 2}""");
    }

    [Fact]
    public void SplitString_WithEmptyInput_ShouldReturnEmptyList()
    {
        // Arrange
        var input = "";

        // Act
        var result = _telemetryService.SplitString(input);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public void Parse_WithRealTelemetryData_ShouldParseAllFields()
    {
        // Arrange - realistic telemetry data
        var input = """
        {
            "Car_id": "ford_mustang_fr500s",
            "Brake": 0.0,
            "Fuel_level": 45.7,
            "Gear": 4,
            "Track_name": "Laguna Seca",
            "Track_id": "laguna_seca_full",
            "Lap_current_lap_time": 95.456,
            "Lap_dist_pct": 0.42,
            "Lap_id": "lap_001",
            "Lat": 36.5844,
            "Lon": -121.7544,
            "Player_car_position": 3,
            "Rpm": 6800.0,
            "Session_id": "practice_001",
            "Session_num": "1",
            "Session_time": 1250.5,
            "Speed": 185.4,
            "Steering_wheel_angle": -15.7,
            "Throttle": 0.85,
            "Tick_time": "2024-06-10T15:30:45.123Z",
            "Velocity_x": 180.2,
            "Velocity_y": -5.8
        }
        """;

        // Act
        var result = _telemetryService.Parse(input);

        // Assert
        result.Should().HaveCount(1);
        var data = result.First();

        data.Car_id.Should().Be("ford_mustang_fr500s");
        data.Brake.Should().Be(0.0);
        data.Fuel_level.Should().Be(45.7);
        data.Gear.Should().Be(4);
        data.Track_name.Should().Be("Laguna Seca");
        data.Track_id.Should().Be("laguna_seca_full");
        data.Lap_current_lap_time.Should().Be(95.456);
        data.Lap_dist_pct.Should().Be(0.42);
        data.Lap_id.Should().Be("lap_001");
        data.Lat.Should().Be(36.5844);
        data.Lon.Should().Be(-121.7544);
        data.Player_car_position.Should().Be(3);
        data.Rpm.Should().Be(6800.0);
        data.Session_id.Should().Be("practice_001");
        data.Session_num.Should().Be("1");
        data.Session_time.Should().Be(1250.5);
        data.Speed.Should().Be(185.4);
        data.Steering_wheel_angle.Should().Be(-15.7);
        data.Throttle.Should().Be(0.85);
        data.Tick_time.Should().Be("2024-06-10T15:30:45.123Z");
        data.Velocity_x.Should().Be(180.2);
        data.Velocity_y.Should().Be(-5.8);
    }
}
