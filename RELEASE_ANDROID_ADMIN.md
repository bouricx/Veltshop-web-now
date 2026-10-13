# Veltshop Admin Android 1.0.0 — 14 October 2026 (Thailand)

Installable signed APK: `/downloads/veltshop-admin-1.0.0.apk`.
Package: `com.veltshop.admin`; minimum Android 8.0 (API 26), target API 35.
Size: 258,773 bytes. APK SHA-256: `df3c27361674a01de379357e885012cfdf3f5b4caac8cbbee8d28d8ab5963e56`.

The APK is a native Java app with its own header, navigation, connection-error
screen and system file picker. The authenticated admin interface is the shop's
live WebView over HTTPS. It reuses server-side account/permission enforcement,
real inventory and health records, notifications and encrypted order support.
No staff identity, password, privileged token or API key is bundled. It does not
add a backend, grant admin privileges or duplicate customer data on the device.

Email/password sign-in is supported inside the app; browser OAuth does not share
WebView cookies. Native shortcuts lead to dashboard, products, cart requests,
notifications and system status. Customer replies are sent through the existing
order conversation UI on paid, delivered orders. Rotate-to-edit keeps the live
WebView and drafts. Network failures show a retry screen rather than fake data.

Validation: Android resource linking, Java compilation and DEX packaging pass;
trusted-origin tests reject HTTP, lookalike hosts, userinfo, wrong ports and
file/content/javascript/intent navigation; actual admin tab routes are verified.
Zip alignment and APK v2/v3 signature verification pass. CI builds unsigned code
without the private signing key and separately verifies the published release.
The signed release installed on an Android 15 (API 35) AOSP emulator and its
activity opened with a visible drawn surface and the SECURE window flag. No
AndroidRuntime fatal exception was observed. This software-only emulator had
system UI stalls, so complete interactive sign-in, uploads and customer replies
remain unverified on a physical phone. No production customer messages were
sent during validation. The browser backend's existing verification remains enabled.

The signing key is private and outside git. Keep it securely for future APK
updates, and increment both manifest versionCode and versionName for releases.
Protected screenshots, disabled cloud backup, rejection of invalid certificates,
first-party cookies only and no JavaScript/native bridge are intentional defaults.
Normal web sign-out is on the account page; native local-data clearing affects
only this app. Background push notifications and offline writes are not included.
See `android-admin/README.md` for build and operational details.
