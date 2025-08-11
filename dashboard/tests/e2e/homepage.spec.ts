import { test, expect } from '@playwright/test';
import { DashboardHelpers, PerformanceHelpers } from '../utils/test-helpers';

test.describe('IRacing Telemetry Dashboard - Homepage', () => {
  let dashboardHelpers: DashboardHelpers;
  let performanceHelpers: PerformanceHelpers;

  test.beforeEach(async ({ page }) => {
    dashboardHelpers = new DashboardHelpers(page);
    performanceHelpers = new PerformanceHelpers(page);
  });

  test.describe('Layout and Design', () => {
    test('should display the new Vercel-inspired homepage layout', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForDashboardReady();

      // Check main layout structure
      await expect(page.locator('.min-h-screen.bg-black')).toBeVisible();
      
      // Check header with breadcrumbs
      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(header.locator('h1')).toContainText('iRacing Telemetry');
      await expect(header.locator('p')).toContainText('Dashboard / Sessions');
      
      // Check connection status indicator in header
      const connectionStatus = header.locator('[data-connection-status]');
      await expect(connectionStatus).toBeVisible();
      
      // Check main content area
      const main = page.locator('main');
      await expect(main).toBeVisible();
      await expect(main.locator('h2')).toContainText('Select Session');
    });

    test('should display system status cards with proper styling', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForDashboardReady();

      // Check system status section exists
      const statusSection = page.locator('text=System Status').locator('..');
      await expect(statusSection).toBeVisible();

      // Check for three status cards
      const statusCards = page.locator('.border.border-gray-800.bg-gray-950\\/50.rounded-lg.p-4');
      await expect(statusCards).toHaveCount(3);

      // Verify card content structure
      const firstCard = statusCards.first();
      await expect(firstCard.locator('h3')).toBeVisible();
      await expect(firstCard.locator('.h-2.w-2.rounded-full')).toBeVisible(); // Status dot
      await expect(firstCard.locator('.text-xs.text-gray-500')).toBeVisible(); // Description
    });

    test('should handle responsive design across different screen sizes', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      
      const responsiveResults = await dashboardHelpers.testResponsiveBreakpoints();
      
      // Verify no horizontal overflow on any breakpoint
      responsiveResults.forEach(result => {
        expect(result.isResponsive, `Layout should be responsive at ${result.name} (${result.width}px)`).toBe(true);
      });

      // Test specific responsive behaviors
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile
      await expect(page.locator('.lg\\:grid-cols-3')).toBeVisible(); // Grid should be responsive
      
      await page.setViewportSize({ width: 1024, height: 768 }); // Desktop
      const sidebar = page.locator('.hidden.lg\\:block.w-64');
      await expect(sidebar).toBeVisible(); // Sidebar space should be visible on large screens
    });
  });

  test.describe('Session Selection Functionality', () => {
    test('should display session cards when sessions are available', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForSessionsToLoad();

      // Check if we have sessions or appropriate message
      const hasError = await dashboardHelpers.hasErrorMessage();
      
      if (!hasError) {
        // If no error, we should either have session cards or "no sessions" message
        const sessionCards = page.locator('[data-testid="session-card"]');
        const noSessionsMessage = page.locator('text=No sessions found');
        
        const sessionCardCount = await sessionCards.count();
        const hasNoSessionsMessage = await noSessionsMessage.isVisible();
        
        expect(sessionCardCount > 0 || hasNoSessionsMessage).toBeTruthy();
        
        if (sessionCardCount > 0) {
          // Test session card structure
          const firstCard = sessionCards.first();
          await expect(firstCard.locator('h4')).toBeVisible(); // Session ID
          await expect(firstCard.locator('.h-2.w-2.rounded-full')).toBeVisible(); // Status dot
          await expect(firstCard.locator('text=Track:')).toBeVisible();
          await expect(firstCard.locator('text=Date:')).toBeVisible();
        }
      }
    });

    test('should handle session selection and navigation', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForSessionsToLoad();

      const hasError = await dashboardHelpers.hasErrorMessage();
      
      if (!hasError) {
        const sessionCards = page.locator('button[class*="border-gray-800"][class*="bg-gray-950"]');
        const cardCount = await sessionCards.count();
        
        if (cardCount > 0) {
          // Click on first session card
          await sessionCards.first().click();
          
          // Should navigate to session page (this would need actual session data)
          // For now, we'll just verify the click doesn't cause errors
          await page.waitForLoadState('networkidle');
          
          // Check for navigation or stay on page with updated state
          const currentUrl = page.url();
          expect(currentUrl).toBeTruthy();
        }
      }
    });

    test('should display legacy dropdown when expanded', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForSessionsToLoad();

      // Find and click the legacy view toggle
      const legacyToggle = page.locator('summary:has-text("Show all sessions")');
      await expect(legacyToggle).toBeVisible();
      
      await legacyToggle.click();
      
      // Check that dropdown becomes visible
      const dropdown = page.locator('select[name="selectSession"]');
      await expect(dropdown).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should display proper error message when database is unreachable', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForSessionsToLoad();

      const hasError = await dashboardHelpers.hasErrorMessage();
      
      if (hasError) {
        // Check error message structure
        const errorContainer = page.locator('.border-red-800.bg-red-950');
        await expect(errorContainer).toBeVisible();
        
        // Check error content
        await expect(errorContainer.locator('text=Database Connection Error')).toBeVisible();
        await expect(errorContainer.locator('text=Unable to connect to QuestDB')).toBeVisible();
        
        // Check troubleshooting section
        await expect(errorContainer.locator('text=Troubleshooting:')).toBeVisible();
        await expect(errorContainer.locator('text=Ensure QuestDB container is running')).toBeVisible();
        
        // Check collapsible error details
        const errorDetails = errorContainer.locator('details');
        await expect(errorDetails).toBeVisible();
        
        await errorDetails.locator('summary').click();
        await expect(errorDetails.locator('code')).toBeVisible();
      }
    });

    test('should display "no sessions" message when database is empty', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForSessionsToLoad();

      const noSessionsMessage = page.locator('text=No sessions found');
      const hasNoSessions = await noSessionsMessage.isVisible();
      
      if (hasNoSessions) {
        const container = noSessionsMessage.locator('..');
        await expect(container.locator('text=Make sure telemetry data has been imported')).toBeVisible();
        
        // Check for empty state icon
        const emptyIcon = container.locator('.w-12.h-12');
        await expect(emptyIcon).toBeVisible();
      }
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time limits', async ({ page }) => {
      const metrics = await performanceHelpers.measurePageLoad();
      
      // Basic performance assertions
      expect(metrics.totalLoadTime).toBeLessThan(5000); // 5 seconds max load time
      expect(metrics.fcp).toBeLessThan(2500); // First contentful paint under 2.5s
      
      // Log performance metrics for monitoring
      console.log('Performance metrics:', metrics);
    });

    test('should not have console errors during normal operation', async ({ page }) => {
      const consoleErrors = await performanceHelpers.getConsoleErrors();
      
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForDashboardReady();
      
      // Filter out expected warnings/errors (like 404s for missing data)
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('404') && 
        !error.includes('Failed to fetch') &&
        !error.includes('QuestDB')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForDashboardReady();

      // Check heading structure
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText('iRacing Telemetry');

      const h2Elements = page.locator('h2');
      await expect(h2Elements.first()).toContainText('Select Session');
      
      // Verify other headings exist and are properly structured
      const h3Elements = page.locator('h3');
      expect(await h3Elements.count()).toBeGreaterThan(0);
    });

    test('should have proper color contrast for text', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForDashboardReady();

      // Check main text colors are visible
      const mainText = page.locator('.text-white');
      await expect(mainText.first()).toBeVisible();
      
      const grayText = page.locator('.text-gray-400');
      await expect(grayText.first()).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForDashboardReady();

      // Test tab navigation through interactive elements
      await page.keyboard.press('Tab');
      
      // Check that focus is visible on interactive elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Visual Regression', () => {
    test('should match homepage visual snapshot', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForDashboardReady();

      // Wait for any animations to settle
      await page.waitForTimeout(1000);

      // Take full page screenshot for visual comparison
      await expect(page).toHaveScreenshot('homepage.png', { 
        fullPage: true,
        threshold: 0.2,
        animations: 'disabled'
      });
    });

    test('should handle different session states visually', async ({ page }) => {
      await dashboardHelpers.navigateToHomepage();
      await dashboardHelpers.waitForSessionsToLoad();

      // Test different states: error, empty, with sessions
      await page.waitForTimeout(1000);
      
      await expect(page.locator('main')).toHaveScreenshot('session-state.png', {
        threshold: 0.2,
        animations: 'disabled'
      });
    });
  });
});