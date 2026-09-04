import UIKit
import React_RCTAppDelegate

// The Info.plist references this class by name via
// `UIApplicationSceneManifest > UISceneDelegateClassName`. UIKit resolves it at
// runtime with `NSClassFromString`, so the `@objc(SceneDelegate)` attribute is
// required to expose a plain (non module-namespaced) Objective-C symbol that
// matches the string in the plist exactly.
//
// Adopting the UIScene lifecycle is required on iOS 26/27, where the legacy
// `UIApplicationDelegate` window path is no longer the effective one. Without a
// valid scene the app can end up with a nil/zero-bounds window, which under
// Detox instrumentation crashes at startup during scene creation.
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    let window = UIWindow(windowScene: windowScene)

    // Ensure the window has a valid frame even in headless/CI environments
    // (e.g. "Designed for iPad on macOS" or a headless simulator) where the
    // scene's coordinate space may initially report zero bounds. Use the
    // scene-owned screen (UIScreen.main is deprecated on iOS 26/27).
    if window.frame.isEmpty {
      window.frame = windowScene.screen.bounds
      if window.frame.isEmpty {
        window.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
      }
    }

    // Hand the window to React Native's factory so it builds the root view
    // controller and mounts the RN surface into this scene's window.
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    appDelegate.reactNativeFactory.startReactNative(
      withModuleName: appDelegate.moduleName ?? "ReactNativeTesApp",
      in: window,
      initialProperties: appDelegate.initialProps ?? [:],
      launchOptions: nil
    )

    self.window = window

    // Force layout so the root view controller's view has real bounds
    // immediately. Without this, screen-capture / preview in headless CI can
    // observe {0,0} bounds.
    window.layoutIfNeeded()
  }
}
