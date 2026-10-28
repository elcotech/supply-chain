# E-SCON — Android Build Guide

This document explains how the E-SCON web app is packaged as an Android app with
**Capacitor** and how to produce a **debug APK** and a **signed release AAB** for
the Google Play Store.

> **Never commit** `android/keystore.jks`, `android/keystore.properties`, the
> keystore password, or `.env.local`. They are already gitignored. Treat the
> keystore as permanent — losing it means you can never update the app on Play
> Store again.

---

## 1. What the Android app is

- The app is the same React web build, wrapped by **Capacitor v6** and loaded
  into a native WebView (`androidScheme: https`).
- Config: [`capacitor.config.json`](../capacitor.config.json)
  - `appId` / `namespace`: `et.escon.supplychain`
  - `appName`: `E-SCON`
  - `webDir`: `build` (the output of `npm run build`)
- Android project lives in [`android/`](../android).
- `minSdkVersion 22`, `compileSdkVersion 34`, `targetSdkVersion 34`
  ([`android/variables.gradle`](../android/variables.gradle)).

---

## 2. Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Node.js | 18 LTS | build the web app |
| **JDK 17** | 17.0.20.1 | required by Gradle 8 / AGP 8 |
| Android SDK | platform `android-34`, build-tools `34.0.0` | via `sdkmanager` |
| Gradle | 8.2.1 | supplied by the wrapper, no manual install |

### This machine's exact paths

These are the values used to build the shipped artifacts. Adjust for your own
machine.

- **JDK 17 (portable):** `C:\Users\ETHIOMK\escon-tools\jdk17\jdk-17.0.20.1+1`
- **Android SDK:** `%LOCALAPPDATA%\Android\Sdk`
  (`C:\Users\ETHIOMK\AppData\Local\Android\Sdk`)
  - `adb`: `...\Sdk\platform-tools\adb.exe`
- **Gradle binary (from the wrapper cache):**
  `C:\Users\ETHIOMK\.gradle\wrapper\dists\gradle-8.2.1-bin\7rip53mtrsp9w9jlopbj87iw\gradle-8.2.1\bin\gradle.bat`
- **Keystore:** `android/keystore.jks`
  (backup: `C:\Users\ETHIOMK\escon-tools\keys\escon-release.jks`)
- **Signing config:** `android/keystore.properties` (gitignored)

> **Disk space:** the C: drive is the constraint. Gradle's build output is
> redirected off the project drive to `C:\Users\ETHIOMK\escon-build` via an
> init script, because the project lives on F: which is nearly full. See §5.

---

## 3. One-time setup

```powershell
# 1. Install Capacitor + Android platform (already in package.json)
npm install

# 2. Generate / refresh the native project (also runs after config changes)
npx cap add android        # first time only
npx cap sync android       # copies the web build into android/
```

Set the environment for a build:

```powershell
$env:JAVA_HOME = "C:\Users\ETHIOMK\escon-tools\jdk17\jdk-17.0.20.1+1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

---

## 4. Building the web assets

The native app embeds whatever is in `build/`, so **always rebuild the web app
before syncing**.

```powershell
npm run build              # → build/
npx cap sync android       # copy build/ into the Android project
```

> The Supabase URL/key are compiled into the JS bundle at `npm run build` time
> from `.env.local` when present. The v6.1 build syncs **all shared business
> data** (products, accounts, orders, wallets, carts, settings) through the cloud
> module when those values are present; without them it stays local-only. See
> [CLOUD_DATABASE.md](./CLOUD_DATABASE.md).

---

## 5. Building a debug APK

The debug build is for testing on a device/emulator.

```powershell
# From android/, using the Gradle binary directly (avoids the wrapper download)
$env:JAVA_HOME = "C:\Users\ETHIOMK\escon-tools\jdk17\jdk-17.0.20.1+1"
& "C:\Users\ETHIOMK\.gradle\wrapper\dists\gradle-8.2.1-bin\7rip53mtrsp9w9jlopbj87iw\gradle-8.2.1\bin\gradle.bat" `
    assembleDebug --no-daemon `
    --init-script "C:\Users\ETHIOMK\escon-tools\builddir-init.gradle"
```

- **Output:** `C:\Users\ETHIOMK\escon-build\_app\outputs\apk\debug\app-debug.apk`
  (copy it out to the project root as `E-SCON-debug.apk` if you want it handy).
- The init script moves each module's `buildDir` to
  `C:\Users\ETHIOMK\escon-build\<module>` so nothing is written to the
  almost-full F: drive. Note the module folder for `:app` is **`_app`**
  (the leading `:` becomes `_`), so outputs live under
  `C:\Users\ETHIOMK\escon-build\_app\outputs\…`.

### Install on a connected phone

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "E-SCON-debug.apk"
```

> If `adb devices` shows **no device**, enable **Developer Options → USB
> debugging** on the phone and accept the authorization prompt on the device.

---

## 6. Building a signed release AAB (Play Store)

An **Android App Bundle** (`.aab`) is what Google Play requires.

1. Ensure `android/keystore.properties` exists and points at the keystore:

   ```properties
   storeFile=../keystore.jks
   storePassword=<your-keystore-password>
   keyAlias=escon
   keyPassword=<your-key-password>
   ```

   `android/app/build.gradle` already reads this file and wires it as the
   `release` signing config. If the file is missing, the release build is
   **unsigned**.

2. Build:

   ```powershell
   $env:JAVA_HOME = "C:\Users\ETHIOMK\escon-tools\jdk17\jdk-17.0.20.1+1"
   & "C:\Users\ETHIOMK\.gradle\wrapper\dists\gradle-8.2.1-bin\7rip53mtrsp9w9jlopbj87iw\gradle-8.2.1\bin\gradle.bat" `
       bundleRelease --no-daemon `
       --init-script "C:\Users\ETHIOMK\escon-tools\builddir-init.gradle"
   ```

- **Output:** `C:\Users\ETHIOMK\escon-build\_app\outputs\bundle\release\app-release.aab`
  (copy it out to the project root as `E-SCON-release.aab`).

3. Verify the signature. An `.aab` is a signed JAR, so use `jarsigner` (not
   `apksigner`, which only reads APKs):

   ```powershell
   & "$env:JAVA_HOME\bin\jarsigner.exe" -verify "E-SCON-release.aab"
   ```

   A successful verification prints `jar verified.` and exits with code `0`.
   (For the debug APK, `apksigner.bat verify --print-certs E-SCON-debug.apk`
   works.)

---

## 7. Versioning

The shipped build is currently **`versionCode 5` / `versionName "1.4"`**
(`android/app/build.gradle`). Before each Play Store upload, bump both:

```gradle
versionCode 6          // integer, must increase every upload
versionName "1.5"      // human-readable
```

Also bump `VERSION` at the top of [`public/sw.js`](../public/sw.js) so installed
PWA clients purge their cached assets (this does **not** touch user data). Current
value: `e-scon-v1.7.0`.

---

## 8. Creating / backing up the keystore

Only do this once; reuse the same keystore forever.

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
    -keystore android\keystore.jks `
    -alias escon -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass "<password>" -keypass "<password>" `
    -dname "CN=E-SCON, OU=Mobile, O=E-SCON, L=Addis Ababa, C=ET"
```

**Back up `keystore.jks` and its password somewhere safe** (e.g. the
`escon-tools\keys\` folder, a password manager, and an off-machine copy).

---

## 9. Release checklist

- [ ] `npm run build` succeeds (`.env.local` is optional; without it the app stays local-only).
- [ ] `npx cap sync android` run.
- [ ] `versionCode` / `versionName` bumped.
- [ ] `public/sw.js` `VERSION` bumped.
- [ ] Launcher icons still match `public/logo512.png` (§10).
- [ ] `bundleRelease` succeeds.
- [ ] `.aab` signature verified.
- [ ] Upload to Google Play Console (see
      [PLAY_STORE_LISTING.md](./PLAY_STORE_LISTING.md) and
      [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)).
- [ ] Test the uploaded bundle via an internal-testing track before production
      (including that screenshots work — §11).

---

## 10. Icons & branding

The **single source of truth for the app icon is [`public/logo512.png`](../public/logo512.png)**.
The web/PWA icons and every Android launcher icon are generated from it, so the
phone icon, the browser tab (`favicon.ico`), the PWA icon (`logo192.png`) and the
in-app logo are the same mark.

| Target | File(s) |
| --- | --- |
| Browser tab | `public/favicon.ico` (16 / 32 / 48 PNG entries) |
| PWA / install icon | `public/logo192.png`, `public/logo512.png` |
| Android legacy icon | `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` (48 / 72 / 96 / 144 / 192) |
| Android round icon | same folders, `ic_launcher_round.png` |
| Android adaptive foreground | same folders, `ic_launcher_foreground.png` (108 / 162 / 216 / 324 / 432; logo inside the 66% safe zone) |
| Adaptive background | `res/values/ic_launcher_background.xml` → `#FFFFFF` |

`AndroidManifest.xml` wires `android:icon="@mipmap/ic_launcher"` and
`android:roundIcon="@mipmap/ic_launcher_round"`; the `<adaptive-icon>` XMLs live in
`res/mipmap-anydpi-v26/`.

**To replace the icon**, drop a new `public/logo512.png` (square is best; the
generator letterboxes non-square art on white) and resize it into every target
above with any image tool, e.g. ImageMagick:

```powershell
# master 512x512 on white, then every launcher size
magick public/logo512.png -resize 512x512 -background white -gravity center -extent 512x512 master.png
foreach ($d in @('mdpi:48','hdpi:72','xhdpi:96','xxhdpi:144','xxxhdpi:192')) {
  $p = $d.Split(':'); $dir = "android/app/src/main/res/mipmap-$($p[0])"
  magick "logo512.png" -background white -gravity center -resize "$(($p[1]))x" -extent "48x48" "$dir/ic_launcher.png"
}
```

Rebuild (§5 / §6) after changing any icon, because the icons are compiled into the
APK/AAB.

---

## 11. Screenshots

Screenshots and screen recordings are **allowed** in the v6.0 Android app.
[`MainActivity.java`](../android/app/src/main/java/et/escon/supplychain/MainActivity.java)
does **not** set `WindowManager.LayoutParams.FLAG_SECURE`, so the standard
Android shortcuts work on every page (catalogue, prices, proforma, wallet) and
the recents preview is not blanked.

Notes:

- The same is true in a browser tab / installed PWA: capture works normally.
- Store screenshots can be taken directly from a debug or release install.
- If a future release needs to block captures again, re-add `FLAG_SECURE` in
  `onCreate` and update this section; there is currently no in-app switch.
- Printing/PDF export of the proforma is unaffected (it is the app's own
  rendering pipeline, not a screen capture).

---

## 12. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Unsupported class file major version` | Wrong JDK — set `JAVA_HOME` to **JDK 17** |
| `SDK location not found` | Set `ANDROID_HOME` or create `android/local.properties` with `sdk.dir=...` |
| Gradle tries to download the distribution | Use the cached `gradle.bat` path directly (§5), and keep `gradle-wrapper.properties` on the official HTTPS URL |
| Out of disk space on F: | Ensure the `--init-script builddir-init.gradle` redirect is used, or free space |
| Release build is unsigned | `android/keystore.properties` missing or wrong `storeFile` path |
| `adb devices` empty | Enable USB debugging and authorize the computer on the phone |
| App icon does not change on the phone | Reinstall (not just update) after `cap sync`; launchers cache icons — §10 |
