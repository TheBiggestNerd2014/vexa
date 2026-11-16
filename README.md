# Vexa

Vexa records your screen, your camera, and your microphone into one video. You can place the camera and keep the controls out of the picture.

Everything stays on your computer.

## Develop

```bash
npm install
npm run dev
```

## Windows installer

On Windows:

```bash
npm run dist:win
```

The MSI is written to `release/`. Building it downloads the WiX tools the first time.

## macOS disk image

A DMG cannot be built on Windows. GitHub Actions builds it on a Mac runner.

Push a tag such as `v0.1.0`, or run the **Build** workflow by hand. The macOS job uploads `Vexa-<version>-arm64.dmg` and `Vexa-<version>-x64.dmg`. Without an Apple certificate the app is unsigned: right-click it and choose Open the first time.

To sign the Mac build, add repository secrets `CSC_LINK` and `CSC_KEY_PASSWORD`.

## Permissions

- Windows asks for the camera and microphone the first time you turn them on.
- macOS also asks for screen recording and system audio. System audio needs macOS 14.2 or newer. If it does not start, turn on “Use the macOS share picker” in Advanced settings.
