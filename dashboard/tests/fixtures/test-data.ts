/**
 * Test data fixtures for IRacing Telemetry Dashboard
 */

export const mockSessions = [
  {
    session_id: 'mock-session-monza-001',
    last_updated: new Date('2024-01-15T14:30:00Z'),
    track_name: 'Monza'
  },
  {
    session_id: 'mock-session-spa-001',
    last_updated: new Date('2024-01-14T09:15:00Z'),
    track_name: 'Spa-Francorchamps'
  },
  {
    session_id: 'mock-session-silverstone-001',
    last_updated: new Date('2024-01-13T16:45:00Z'),
    track_name: 'Silverstone'
  },
  {
    session_id: 'mock-session-nurburgring-001',
    last_updated: new Date('2024-01-12T11:20:00Z'),
    track_name: 'Nürburgring'
  },
  {
    session_id: 'mock-session-imola-001',
    last_updated: new Date('2024-01-11T13:30:00Z'),
    track_name: 'Imola'
  }
];

export const mockTelemetryData = [
  {
    LapDistPct: 0.0,
    Speed: 45.2,
    Throttle: 0.8,
    Brake: 0.0,
    Gear: 2,
    RPM: 4500,
    SteeringWheelAngle: 0.1,
    LapCurrentLapTime: 0.0,
    PlayerCarPosition: 1,
    FuelLevel: 95.5,
    Lat: 45.6205,
    Lon: 9.2897,
    SessionTime: 0.0,
    TrackName: 'Monza'
  },
  {
    LapDistPct: 0.1,
    Speed: 78.3,
    Throttle: 1.0,
    Brake: 0.0,
    Gear: 3,
    RPM: 6200,
    SteeringWheelAngle: -0.2,
    LapCurrentLapTime: 5.2,
    PlayerCarPosition: 1,
    FuelLevel: 95.3,
    Lat: 45.6208,
    Lon: 9.2902,
    SessionTime: 5.2,
    TrackName: 'Monza'
  },
  {
    LapDistPct: 0.2,
    Speed: 125.7,
    Throttle: 1.0,
    Brake: 0.0,
    Gear: 5,
    RPM: 7800,
    SteeringWheelAngle: 0.05,
    LapCurrentLapTime: 12.1,
    PlayerCarPosition: 1,
    FuelLevel: 95.0,
    Lat: 45.6212,
    Lon: 9.2908,
    SessionTime: 12.1,
    TrackName: 'Monza'
  }
];

export const mockTrackBounds = {
  minLat: 45.6180,
  maxLat: 45.6230,
  minLon: 9.2850,
  maxLon: 9.2950
};

export const mockSystemStatus = {
  database: {
    status: 'connected',
    message: 'QuestDB Connected',
    responseTime: 45
  },
  processing: {
    status: 'active',
    mode: 'Runtime Dynamic',
    lastUpdate: new Date('2024-01-15T14:30:00Z')
  },
  sessions: {
    total: 25,
    recent: 5,
    lastSession: new Date('2024-01-15T14:30:00Z')
  }
};

export const mockErrorStates = {
  databaseError: {
    error: true,
    message: 'Connection timeout: Unable to connect to QuestDB at localhost:8812',
    code: 'CONNECTION_TIMEOUT'
  },
  noSessions: {
    error: false,
    sessions: [],
    message: 'No telemetry sessions found in database'
  },
  invalidSession: {
    error: true,
    message: 'Session ID not found: invalid-session-123',
    code: 'SESSION_NOT_FOUND'
  },
  processingError: {
    error: true,
    message: 'Failed to process telemetry data: corrupt data format',
    code: 'PROCESSING_ERROR'
  }
};

export const mockApiResponses = {
  sessions: {
    success: {
      status: 200,
      data: mockSessions
    },
    error: {
      status: 500,
      error: mockErrorStates.databaseError
    },
    empty: {
      status: 200,
      data: []
    }
  },
  telemetry: {
    success: {
      status: 200,
      data: {
        dataWithGPSCoordinates: mockTelemetryData,
        trackBounds: mockTrackBounds,
        processError: null
      }
    },
    error: {
      status: 500,
      data: {
        dataWithGPSCoordinates: [],
        trackBounds: null,
        processError: mockErrorStates.processingError.message
      }
    }
  },
  health: {
    healthy: {
      status: 200,
      data: {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      }
    },
    unhealthy: {
      status: 503,
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      }
    }
  }
};

/**
 * Mock route handlers for testing
 */
export const mockRouteHandlers = {
  // Mock successful sessions endpoint
  mockSessionsSuccess: async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSessions)
    });
  },

  // Mock sessions endpoint error
  mockSessionsError: async (route: any) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify(mockErrorStates.databaseError)
    });
  },

  // Mock empty sessions response
  mockSessionsEmpty: async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  },

  // Mock telemetry data success
  mockTelemetrySuccess: async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dataWithGPSCoordinates: mockTelemetryData,
        trackBounds: mockTrackBounds,
        processError: null
      })
    });
  },

  // Mock telemetry data error
  mockTelemetryError: async (route: any) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        dataWithGPSCoordinates: [],
        trackBounds: null,
        processError: mockErrorStates.processingError.message
      })
    });
  },

  // Mock health check success
  mockHealthSuccess: async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.health.healthy.data)
    });
  },

  // Mock health check failure
  mockHealthError: async (route: any) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.health.unhealthy.data)
    });
  }
};

/**
 * Test scenarios for different application states
 */
export const testScenarios = {
  // Happy path: everything working
  allSystemsOperational: {
    sessions: mockRouteHandlers.mockSessionsSuccess,
    health: mockRouteHandlers.mockHealthSuccess,
    description: 'All systems operational with available sessions'
  },

  // Database connection issues
  databaseConnectionError: {
    sessions: mockRouteHandlers.mockSessionsError,
    health: mockRouteHandlers.mockHealthError,
    description: 'Database connection error scenario'
  },

  // Empty database
  noSessionsAvailable: {
    sessions: mockRouteHandlers.mockSessionsEmpty,
    health: mockRouteHandlers.mockHealthSuccess,
    description: 'No sessions available in database'
  },

  // Partial system failure
  healthyButNoSessions: {
    sessions: mockRouteHandlers.mockSessionsEmpty,
    health: mockRouteHandlers.mockHealthSuccess,
    description: 'System healthy but no telemetry sessions'
  }
};