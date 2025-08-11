import { Page, Locator, expect } from '@playwright/test';

/**
 * Test helper utilities for IRacing Telemetry Dashboard
 */

export class DashboardHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to homepage and wait for it to load
   */
  async navigateToHomepage() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for dashboard to be ready (no loading states)
   */
  async waitForDashboardReady() {
    // Wait for main content to be visible
    await expect(this.page.locator('main')).toBeVisible();
    
    // Wait for any loading indicators to disappear
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get status indicators from the header
   */
  getConnectionStatus(): Locator {
    return this.page.locator('[data-testid="connection-status"]');
  }

  /**
   * Get system status cards
   */
  getSystemStatusCards(): Locator {
    return this.page.locator('[data-testid="system-status-card"]');
  }

  /**
   * Get session selection area
   */
  getSessionSelector(): Locator {
    return this.page.locator('[data-testid="session-selector"]');
  }

  /**
   * Get session cards
   */
  getSessionCards(): Locator {
    return this.page.locator('[data-testid="session-card"]');
  }

  /**
   * Select a session by ID
   */
  async selectSessionById(sessionId: string) {
    const sessionCard = this.page.locator(`[data-testid="session-card-${sessionId}"]`);
    await sessionCard.click();
  }

  /**
   * Check if error message is displayed
   */
  async hasErrorMessage(): Promise<boolean> {
    const errorElement = this.page.locator('[data-testid="error-message"]');
    return await errorElement.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    const errorElement = this.page.locator('[data-testid="error-message"]');
    return await errorElement.textContent() || '';
  }

  /**
   * Wait for sessions to load
   */
  async waitForSessionsToLoad(timeout: number = 10000) {
    // Wait for either sessions to appear or error message
    await this.page.waitForFunction(
      () => {
        const hasSessionCards = document.querySelectorAll('[data-testid="session-card"]').length > 0;
        const hasError = document.querySelector('[data-testid="error-message"]') !== null;
        const hasNoSessionsMessage = document.querySelector('[data-testid="no-sessions"]') !== null;
        return hasSessionCards || hasError || hasNoSessionsMessage;
      },
      { timeout }
    );
  }

  /**
   * Take screenshot with timestamp for debugging
   */
  async takeTimestampedScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Verify responsive design at different viewport sizes
   */
  async testResponsiveBreakpoints() {
    const breakpoints = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1024, height: 768 },
      { name: 'large-desktop', width: 1440, height: 900 }
    ];

    const results = [];
    
    for (const breakpoint of breakpoints) {
      await this.page.setViewportSize({ 
        width: breakpoint.width, 
        height: breakpoint.height 
      });
      
      await this.page.waitForTimeout(500); // Allow layout to settle
      
      const isResponsive = await this.page.evaluate(() => {
        // Check if layout doesn't have horizontal overflow
        return document.documentElement.scrollWidth <= window.innerWidth;
      });
      
      results.push({
        ...breakpoint,
        isResponsive,
        actualWidth: await this.page.evaluate(() => document.documentElement.scrollWidth)
      });
    }
    
    return results;
  }
}

/**
 * Mock QuestDB responses for testing
 */
export const MockQuestDB = {
  /**
   * Mock successful sessions response
   */
  mockSessionsSuccess: [
    {
      session_id: 'test-session-1',
      last_updated: new Date('2024-01-15T10:30:00Z'),
      track_name: 'Monza'
    },
    {
      session_id: 'test-session-2', 
      last_updated: new Date('2024-01-14T15:45:00Z'),
      track_name: 'Spa-Francorchamps'
    },
    {
      session_id: 'test-session-3',
      last_updated: new Date('2024-01-13T09:15:00Z'),
      track_name: 'Silverstone'
    }
  ],

  /**
   * Mock database connection error
   */
  mockConnectionError: {
    error: 'Connection failed',
    message: 'Unable to connect to QuestDB'
  }
};

/**
 * Performance testing utilities
 */
export class PerformanceHelpers {
  constructor(private page: Page) {}

  /**
   * Measure page load performance
   */
  async measurePageLoad() {
    const start = Date.now();
    
    await this.page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - start;
    
    const metrics = await this.page.evaluate(() => ({
      // @ts-ignore
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      // @ts-ignore  
      lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
      // @ts-ignore
      cls: performance.getEntriesByType('layout-shift').reduce((sum: number, entry: any) => sum + entry.value, 0)
    }));

    return {
      totalLoadTime: loadTime,
      ...metrics
    };
  }

  /**
   * Check for console errors
   */
  async getConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    return errors;
  }
}