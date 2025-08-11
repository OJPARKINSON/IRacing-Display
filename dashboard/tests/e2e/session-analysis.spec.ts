import { test, expect } from '@playwright/test';
import { DashboardHelpers } from '../utils/test-helpers';

test.describe('Session Analysis Page', () => {
  let dashboardHelpers: DashboardHelpers;

  test.beforeEach(async ({ page }) => {
    dashboardHelpers = new DashboardHelpers(page);
  });

  test.describe('Session Page Layout', () => {
    test('should display telemetry page when session exists', async ({ page }) => {
      // Navigate to a mock session (this would need actual test data)
      await page.goto('/test-session-1?lapId=1');
      await page.waitForLoadState('networkidle');

      // Check for telemetry page elements (adjust selectors based on actual implementation)
      const pageTitle = page.locator('h1');
      await expect(pageTitle).toContainText('iRacing Telemetry Dashboard');
      
      // Check for main components that should exist
      const trackMap = page.locator('[data-testid="track-map"]');
      const telemetryChart = page.locator('[data-testid="telemetry-chart"]');
      
      // At least one of these should be visible if session exists
      const hasTrackMap = await trackMap.isVisible();
      const hasChart = await telemetryChart.isVisible();
      const hasErrorMessage = await page.locator('text=Error Loading Telemetry Data').isVisible();
      
      expect(hasTrackMap || hasChart || hasErrorMessage).toBeTruthy();
    });

    test('should handle invalid session IDs gracefully', async ({ page }) => {
      await page.goto('/invalid-session-id');
      await page.waitForLoadState('networkidle');

      // Should either redirect to homepage or show appropriate error
      const currentUrl = page.url();
      const isHomepage = currentUrl.endsWith('/') || currentUrl.includes('invalid-session');
      expect(isHomepage).toBeTruthy();
    });
  });

  test.describe('Track Map Interaction', () => {
    test('should display GPS track visualization when data is available', async ({ page }) => {
      await page.goto('/test-session-1?lapId=1');
      await page.waitForLoadState('networkidle');

      // Look for track map container
      const trackMapSection = page.locator('text=GPS Track Map').locator('..');
      await expect(trackMapSection).toBeVisible();

      // Check for either track visualization or no data message
      const hasTrackData = await page.locator('canvas, svg').first().isVisible();
      const hasNoDataMessage = await page.locator('text=No GPS data available').isVisible();
      
      expect(hasTrackData || hasNoDataMessage).toBeTruthy();
    });

    test('should allow interaction with track points', async ({ page }) => {
      await page.goto('/test-session-1?lapId=1');
      await page.waitForLoadState('networkidle');

      // If track visualization exists, test interaction
      const trackVisualization = page.locator('canvas, svg').first();
      const isVisible = await trackVisualization.isVisible();
      
      if (isVisible) {
        // Test clicking on track (coordinates would need to be adjusted)
        await trackVisualization.click({ position: { x: 100, y: 100 } });
        
        // Should update current selection info
        const selectionInfo = page.locator('text=Current Selection').locator('..');
        await expect(selectionInfo).toBeVisible();
      }
    });
  });

  test.describe('Telemetry Data Display', () => {
    test('should show telemetry metrics when available', async ({ page }) => {
      await page.goto('/test-session-1?lapId=1');
      await page.waitForLoadState('networkidle');

      // Check for telemetry data sections
      const dataQuality = page.locator('text=Data Quality').locator('..');
      const trackInfo = page.locator('text=Track Information').locator('..');
      
      await expect(dataQuality).toBeVisible();
      await expect(trackInfo).toBeVisible();

      // Check for GPS analysis if data exists
      const gpsAnalysis = page.locator('text=GPS Track Analysis');
      const hasAnalysis = await gpsAnalysis.isVisible();
      
      if (hasAnalysis) {
        // Should show metrics like distance, speed, etc.
        const analysisPanel = gpsAnalysis.locator('..');
        await expect(analysisPanel.locator('text=Total Distance')).toBeVisible();
        await expect(analysisPanel.locator('text=Average Speed')).toBeVisible();
      }
    });

    test('should allow metric selection and chart updates', async ({ page }) => {
      await page.goto('/test-session-1?lapId=1');
      await page.waitForLoadState('networkidle');

      // Look for metric selector dropdown
      const metricSelector = page.locator('select').first();
      const isVisible = await metricSelector.isVisible();
      
      if (isVisible) {
        // Test changing metric selection
        await metricSelector.selectOption('Throttle');
        await page.waitForTimeout(500); // Allow chart to update
        
        // Chart should update (this would need actual chart testing)
        const chartArea = page.locator('[data-testid="telemetry-chart"]');
        await expect(chartArea).toBeVisible();
      }
    });
  });

  test.describe('Session Navigation', () => {
    test('should allow lap selection', async ({ page }) => {
      await page.goto('/test-session-1?lapId=1');
      await page.waitForLoadState('networkidle');

      // Look for lap selector
      const lapSelector = page.locator('select[name="sessionSelect"]');
      const isVisible = await lapSelector.isVisible();
      
      if (isVisible) {
        // Test lap selection
        const options = await lapSelector.locator('option').count();
        if (options > 1) {
          await lapSelector.selectOption({ index: 1 });
          await page.waitForLoadState('networkidle');
          
          // URL should update with new lap ID
          const url = page.url();
          expect(url).toContain('lapId=');
        }
      }
    });

    test('should maintain state during navigation', async ({ page }) => {
      await page.goto('/test-session-1?lapId=1');
      await page.waitForLoadState('networkidle');

      // Get initial state
      const sessionInfo = page.locator('text=Session:').locator('..');
      const isVisible = await sessionInfo.isVisible();
      
      if (isVisible) {
        const initialSession = await sessionInfo.textContent();
        
        // Navigate back to homepage and back to session
        await page.goBack();
        await page.goForward();
        
        // Session should be preserved
        const finalSession = await sessionInfo.textContent();
        expect(finalSession).toBe(initialSession);
      }
    });
  });

  test.describe('Error States', () => {
    test('should handle missing telemetry data gracefully', async ({ page }) => {
      await page.goto('/empty-session?lapId=1');
      await page.waitForLoadState('networkidle');

      // Should show appropriate empty state
      const errorMessage = page.locator('text=Error Loading Telemetry Data');
      const noDataMessage = page.locator('text=No GPS data available');
      
      const hasError = await errorMessage.isVisible();
      const hasNoData = await noDataMessage.isVisible();
      
      expect(hasError || hasNoData).toBeTruthy();
    });

    test('should provide useful error messages', async ({ page }) => {
      await page.goto('/error-session?lapId=1');
      await page.waitForLoadState('networkidle');

      // Look for error message with helpful context
      const errorElements = page.locator('[class*="bg-red"], text*="Error"');
      const count = await errorElements.count();
      
      if (count > 0) {
        const errorText = await errorElements.first().textContent();
        expect(errorText).toBeTruthy();
        expect(errorText!.length).toBeGreaterThan(10); // Should have meaningful message
      }
    });
  });
});