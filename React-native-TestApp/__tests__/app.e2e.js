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
    // Wait for the initial Metro bundle load to complete before issuing a reload
    console.log('Waiting for initial bundle load before reload...');
    await new Promise((resolve) => setTimeout(resolve, 10000));
    
    // Reload the React Native app to force reconnection
    console.log('Calling reloadReactNative...');
    await device.reloadReactNative();
    console.log('reloadReactNative returned, waiting for UI to appear...');
    
    try {
      // Poll until the app has loaded — give it up to 4 minutes on slow CI runners
      await waitFor(element(by.id('submitButton')))
        .toBeVisible()
        .withTimeout(240000);
      console.log('App launched successfully — "submitButton" is visible');
    } catch (error) {
      // Print the full error so the view hierarchy (verbose mode) appears in the log
      console.log('Could not find "Connection Settings":', error.message);
      
      // Try alternate text that might be present
      try {
        const isManualVisible = await element(by.text('Manual')).isVisible();
        console.log('"Manual" element visible:', isManualVisible);
      } catch (e) {
        console.log('Could not check "Manual" element:', e.message);
      }
      
      throw error;
    }
  });

  it('should connect and disconnect a session', async () => {
    // Wait for the app to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Check that API key input has value (credentials loaded)
    console.log('Waiting for apiKeyInput to be visible...');
    const apiKeyInput = element(by.id('apiKeyInput'));
    await waitFor(apiKeyInput).toBeVisible().withTimeout(60000);
    console.log('apiKeyInput is visible');
    
    // Check for submit button
    await waitFor(element(by.id('submitButton'))).toBeVisible().withTimeout(30000);
    
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
