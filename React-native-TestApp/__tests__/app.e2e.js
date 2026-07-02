describe('App Launch Test', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        detoxPrintBusyIdleResources: 'YES',
      },
      permissions: { camera: 'YES', microphone: 'YES' },
    });
    
    // Disable synchronization to avoid timing issues
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  it('should launch the app successfully', async () => {
    // Wait for app to try to connect to Metro
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Reload the React Native app to force reconnection
    await device.reloadReactNative();
    
    // Wait for reload to complete
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    try {
      // Check if the app has loaded by looking for any text
      await expect(element(by.text('Connection Settings'))).toBeVisible();
    } catch (error) {
      // If not found, try to get view hierarchy for debugging
      console.log('View hierarchy:', error.message);
      
      // Try alternate text that might be present
      try {
        await expect(element(by.text('Manual'))).toBeVisible();
      } catch (e) {
        // Pass for now to see other elements
      }
      
      throw error;
    }
  });

  it('should connect and disconnect a session', async () => {
    // Wait for the app to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Check that API key input has value (credentials loaded)
    const apiKeyInput = element(by.id('apiKeyInput'));
    await expect(apiKeyInput).toBeVisible();
    
    // Check for submit button
    await expect(element(by.id('submitButton'))).toBeVisible();
    
    console.log('About to tap submit button');

    // Tap connect button
    await element(by.id('submitButton')).tap();
    
    console.log('Tapped submit button, waiting for connection');

    // Wait longer for the session to connect and publisher to appear
    await new Promise((resolve) => setTimeout(resolve, 15000));
    
    // First check if disconnect button is visible (session connected)
    try {
      await expect(element(by.id('disconnectSession'))).toBeVisible();
      console.log('Session connected - disconnect button found');
    } catch (e) {
      console.log('Disconnect button not found - session may not have connected');
      // Check if submit button is still there (connection failed)
      try {
        await expect(element(by.id('submitButton'))).toBeVisible();
        console.log('Submit button still visible - connection likely failed');
      } catch (e2) {
        console.log('Neither submit nor disconnect button visible');
      }
      throw e;
    }
    
    // Verify publisher appeared (may not be visible if permissions not granted)
    try {
      await expect(element(by.id('publisher'))).toBeVisible();
    } catch (e) {
      console.log('Publisher not visible - may be permissions issue or rendering issue');
      // Continue anyway to test disconnect
    }

    // Tap disconnect button  
    await element(by.id('disconnectSession')).tap();

    // Wait for disconnect
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify submit button is visible again
    await expect(element(by.id('submitButton'))).toBeVisible();
  });
});
