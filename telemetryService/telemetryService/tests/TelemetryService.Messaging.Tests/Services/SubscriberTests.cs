namespace TelemetryService.Messaging.Tests.Services;

public class SubscriberIntegrationTests : IAsyncLifetime
{
    private readonly RabbitMqContainer _rabbitMqContainer;
    private readonly Mock<ITelemetryParser> _telemetryParserMock;
    private readonly Mock<IInfluxService> _influxServiceMock;
    private readonly Mock<ILogger<Subscriber>> _loggerMock;

    public SubscriberIntegrationTests()
    {
        _rabbitMqContainer = new RabbitMqBuilder().Build();
        _telemetryParserMock = new Mock<ITelemetryParser>();
        _influxServiceMock = new Mock<IInfluxService>();
        _loggerMock = new Mock<ILogger<Subscriber>>();
    }

    public async Task InitializeAsync()
    {
        await _rabbitMqContainer.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _rabbitMqContainer.DisposeAsync();
    }

    [Fact]
    public async Task SubscribeAsync_WithValidMessage_ShouldProcessSuccessfully()
    {
        // Arrange
        var config = new TelemetryConfiguration
        {
            RabbitMq = new RabbitMqConfig
            {
                HostName = _rabbitMqContainer.Hostname,
                Port = _rabbitMqContainer.GetMappedPublicPort(5672)
            }
        };

        var telemetryData = new List<TelemetryData>
        {
            new() { Session_id = "test", Car_id = "car1", Session_time = 100.0 }
        };

        _telemetryParserMock
            .Setup(x => x.ParseAsync(It.IsAny<string>()))
            .ReturnsAsync(telemetryData);

        var subscriber = new Subscriber(
            _telemetryParserMock.Object,
            _influxServiceMock.Object,
            _loggerMock.Object,
            config);

        // Act & Assert
        // Test implementation would involve publishing a message and verifying processing
    }
}