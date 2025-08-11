import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🎭 Starting Playwright Global Setup...');
  
  // Launch browser to verify setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Verify the application is running
    await page.goto(config.projects[0].use.baseURL || 'http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('✅ Application is accessible');
    
    // Perform any pre-test setup here if needed
    // e.g., database seeding, authentication, etc.
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('🎭 Global Setup Complete');
}

export default globalSetup;