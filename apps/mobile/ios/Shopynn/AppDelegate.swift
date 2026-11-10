import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FBSDKCoreKit
import AppTrackingTransparency
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  private var privacyCover: UIView?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Required for @react-native-firebase — plist alone does not create the DEFAULT app.
    if FirebaseApp.app() == nil {
      FirebaseApp.configure()
    }

    ApplicationDelegate.shared.application(
      application,
      didFinishLaunchingWithOptions: launchOptions
    )
    if #available(iOS 14, *) {
      ATTrackingManager.requestTrackingAuthorization { _ in
        AppEvents.shared.activateApp()
      }
    } else {
      AppEvents.shared.activateApp()
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Shopynn",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    let handledByFB = ApplicationDelegate.shared.application(
      app, open: url, options: options
    )
    if handledByFB { return true }
    return false
  }

  // The app-switcher snapshot is taken after resigning active; cover the UI so sales, balances
  // and payout details never appear in it.
  func applicationWillResignActive(_ application: UIApplication) {
    guard privacyCover == nil, let window = window else { return }
    let cover = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view
      ?? UIView()
    cover.backgroundColor = cover.backgroundColor ?? .systemBackground
    cover.frame = window.bounds
    cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    window.addSubview(cover)
    privacyCover = cover
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
    privacyCover?.removeFromSuperview()
    privacyCover = nil
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
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
