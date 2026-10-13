# Veltshop Admin for Android

Native Android launcher and navigation shell for the real Veltshop admin website.
The app does not contain an admin password, API key, privileged token, local
inventory database or substitute backend. All data and permission decisions stay
on `https://veltshop-website.vercel.app`.

## Installation and use

Download `/downloads/veltshop-admin-1.0.0.apk` from the published shop and install
on Android 8.0 or later. Launch **Veltshop Admin** and sign in using the email and
password of an existing shop account with the appropriate admin permissions.
The app returns to the selected admin tab after the website's sign-in flow.

- **ภาพรวม**: the protected dashboard and sales summaries.
- **สินค้า**: real catalog, inventory and product editing; system file picker
  supports authorized image uploads without broad storage permissions.
- **ลูกค้า**: cart orders, payment/delivery review, order-specific customer
  conversations and post-delivery corrections.
- **แจ้งเตือน**: the website's real admin inbox while that page is open.
- **ระบบ**: database/provider configuration, scheduler, queues and backup status.

Navigation is restricted to the shop's exact HTTPS origin. External HTTPS links
opened by the user use the browser without transferring shop cookies. JavaScript
interfaces, cleartext HTTP, mixed content, file URL access, third-party cookies,
WebView debugging and Android cloud backups are disabled. Invalid certificates
are rejected. Screenshots/app-switcher previews are protected with FLAG_SECURE.
Rotating the device retains the live WebView and drafts; process recreation
reloads the authenticated website rather than restoring private form snapshots.

Use **บัญชีและออกจากระบบ** for the website's normal sign-out. **ล้างข้อมูลการเข้าสู่ระบบในแอป**
clears this app's cookies/cache/storage only; it does not revoke other sessions
or delete accounts. Downloads that require browser-generated `blob:` URLs should
use **เปิดเว็บในเบราว์เซอร์**. Social OAuth is handled outside the embedded view;
email/password sign-in is the supported in-app flow. There are no background
push notifications or offline administrative writes in this version.

## Build from source

No Gradle, AndroidX or third-party runtime SDK is bundled. A Linux build needs a
JDK with `javac`/`jar`, Python 3, Android SDK platform 35 and build-tools 35.0.0.

```sh
export ANDROID_SDK_ROOT=/path/to/android-sdk
bash android-admin/test.sh
bash android-admin/build.sh --unsigned
```

For an installable release, set `VELTSHOP_KEYSTORE` to a private PKCS12 keystore
with alias `veltshop-admin` and set `VELTSHOP_KEYSTORE_PASSWORD` through the secure
environment, then run `build.sh --signed`. Never commit the keystore or password.
The signing identity must be retained securely for future updates; a different
key cannot update an existing installation. CI compiles independently without
the private key and verifies the published signed APK.

Release 1.0.0 signer certificate SHA-256:
`2e0fb1c8107e78650b66a65164c2287490ec37d91e3e02a37f01753bac80ae83`.

Validation records belong in `RELEASE_ANDROID_ADMIN.md`. The file in
`public/downloads/` is the signed release; `build/` is ignored disposable output.
