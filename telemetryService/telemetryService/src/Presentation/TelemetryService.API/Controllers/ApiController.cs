using Microsoft.AspNetCore.Mvc;

namespace TelemetryService.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult GetTest()
    {
        return Ok(new { message = "Test endpoint working!", timestamp = DateTime.UtcNow });
    }
}
