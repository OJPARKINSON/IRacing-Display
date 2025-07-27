using Microsoft.AspNetCore.Mvc;
using TelemetryService.Infrastructure.Persistence;

namespace TelemetryService.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class HealthController : ControllerBase
{
    private readonly QuestDbService _questDbService;

    public HealthController(QuestDbService questDbService)
    {
        _questDbService = questDbService;
    }

    [HttpGet]
    public IActionResult GetTest()
    {
        return Ok(new { message = "Test endpoint working!", timestamp = DateTime.UtcNow });
    }

    [HttpPost("optimize-schema")]
    public async Task<IActionResult> OptimizeSchema()
    {
        try
        {
            var result = await _questDbService.TriggerSchemaOptimization();
            
            if (result)
            {
                return Ok(new 
                { 
                    message = "Schema optimization completed successfully", 
                    timestamp = DateTime.UtcNow,
                    optimized = true
                });
            }
            else
            {
                return BadRequest(new 
                { 
                    message = "Schema optimization failed or was not needed", 
                    timestamp = DateTime.UtcNow,
                    optimized = false
                });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new 
            { 
                message = "Schema optimization error", 
                error = ex.Message,
                timestamp = DateTime.UtcNow
            });
        }
    }
}
