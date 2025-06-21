using Microsoft.AspNetCore.Mvc;
using TelemetryService.Application.Services;
using TelemetryService.Domain.Models;

namespace TelemetryService.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class CircuitController : ControllerBase
{
    [HttpGet]
    public IActionResult GetCircuit()
    {
        return Ok(new { success = true, data = "tracks" });
    }
}