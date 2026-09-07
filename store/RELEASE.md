# Vydání aplikace — poznámky

## Podepisovací klíč (Android)

Klíč už existuje:

- **Soubor:** `android/keystore/detox21-upload.jks`
- **Heslo + alias:** `android/key.properties`
- **Alias:** `detox21-upload`
- **Platnost:** do roku 2054
- **SHA-256:** `EC:21:3C:D1:30:38:4B:E5:88:D5:0D:AA:72:DA:3D:AA:92:69:A6:08:F8:B5:1F:9D:A1:C1:05:A5:C6:2B:F1:B3`

Oba soubory jsou v `.gitignore` — **nikdy** se nedostanou na GitHub.
Zálohuj si je mimo tento počítač (heslo do správce hesel, `.jks` na
cloud nebo flash disk). Bez nich nejde vydat aktualizace aplikace.

## Build podepsaného balíčku pro Google Play

```
cd android
JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot" ./gradlew bundleRelease
```

Výsledek: `android/app/build/outputs/bundle/release/app-release.aab`
— tenhle soubor se nahrává do Play Console.

Pokud `key.properties` chybí, build projde, ale výstup bude nepodepsaný
(Play ho nepřijme).

## Před každou další verzí

Zvyš `versionCode` (o 1) a `versionName` v `android/app/build.gradle`.
Play odmítne nahrát balíček se stejným `versionCode`.

## iOS

Projekt `ios/` je připravený, ale build vyžaduje macOS s Xcode.
Na Windows ho sestavit nelze. Podepisovací certifikáty pro iOS
spravuje Apple přes Apple Developer účet — negeneruje se ručně
jako u Androidu.

## Screenshoty

`store/screenshots/` — `play-*` mají 1080×1920 (Google Play),
`ios-*` mají 1290×2796 (App Store, 6,9"). Vygenerované z ukázkových
dat, ne z osobních záznamů.
