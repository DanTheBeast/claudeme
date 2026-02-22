import UIKit
import Capacitor
import WebKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    // Pre-warm WKWebView so the JS engine is ready before Capacitor needs it.
    // This runs in parallel with the splash screen, cutting cold-start time significantly.
    private var warmupWebView: WKWebView?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Instantiate a tiny offscreen WKWebView immediately at launch.
        // This forces iOS to spin up the WebContent, Networking, and GPU processes
        // right away instead of waiting until Capacitor's own WebView is created.
        let config = WKWebViewConfiguration()
        warmupWebView = WKWebView(frame: .zero, configuration: config)
        warmupWebView?.loadHTMLString("<html></html>", baseURL: nil)
        return true
    }

    // MARK: - UIScene lifecycle (required going forward)

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {}

    // MARK: - Push notifications (forwarded to Capacitor)

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // MARK: - URL / Universal Links

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
