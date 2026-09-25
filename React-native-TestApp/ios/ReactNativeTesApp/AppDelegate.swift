import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider


@main
class AppDelegate: RCTAppDelegate {
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    self.moduleName = "ReactNativeTesApp"
    self.dependencyProvider = RCTAppDependencyProvider()

    // You can add your custom initial props in the dictionary below.
    // They will be passed down to the ViewController used by React Native.
    self.initialProps = [:]

    // Let the SceneDelegate own the window and mount the React Native surface.
    // Required for the UIScene lifecycle on iOS 26/27: if RCTAppDelegate created
    // the window here (via [UIScreen mainScreen].bounds, without a scene), the
    // app would run without a valid scene-backed window and crash at startup
    // under Detox instrumentation on the new iOS toolchain.
    self.automaticallyLoadReactNativeWindow = false

    // Register OpenTok Fabric components
    FabricComponentRegistrar.registerCustomComponents()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
