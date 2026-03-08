# Fahrbuch EAS Build Instructions

This guide will help you build standalone iOS and Android packages for the Fahrbuch app using EAS Build.

## Prerequisites

1. **Expo Account**: You'll need an Expo account. Sign up at https://expo.dev if you don't have one.
2. **Apple Developer Account**: Required for iOS builds and TestFlight distribution.
3. **Node.js**: Already installed via Homebrew.

## Step 1: Authentication

First, log into your Expo account:

```bash
export PATH="/opt/homebrew/Cellar/node@22/22.22.0/bin:$PATH"
cd fahrbuch
npx eas-cli login
```

## Step 2: Initialize EAS Project

Create the EAS project (this links your local project to Expo's build service):

```bash
npx eas-cli build:configure
```

If prompted, choose:
- **Yes** to automatically generate eas.json (it's already created but may be updated)
- **Yes** to link/create the project on Expo

## Step 3: Build Configuration

The `eas.json` file has been pre-configured with three build profiles:
- **development**: For development builds with Expo Dev Client
- **preview**: For internal testing (ideal for Ben and Robin)
- **production**: For App Store/Play Store submission

## Step 4: Build the Apps

### iOS Build (for TestFlight)

```bash
npx eas-cli build --platform ios --profile preview
```

### Android Build (for direct APK distribution)

```bash
npx eas-cli build --platform android --profile preview
```

### Build Both Platforms

```bash
npx eas-cli build --platform all --profile preview
```

## Step 5: Credentials Setup

During your first build, EAS will help you set up:

### iOS:
- Apple Developer account linking
- Certificate generation (or use existing)
- Provisioning profile setup

### Android:
- Keystore generation (or use existing)
- Play Store credentials (if publishing to Play Store)

**For testing, let EAS generate new credentials automatically.**

## Step 6: Monitor Build Progress

After starting a build:

1. EAS will provide a link to monitor build progress
2. Builds typically take 10-20 minutes
3. You'll get an email when builds complete

## Step 7: Distribution

### iOS (TestFlight):
1. When the iOS build completes, download the `.ipa` file
2. Upload to TestFlight via Xcode or App Store Connect
3. Add Ben and Robin as testers
4. Send them the TestFlight invitation link

### Android (Direct APK):
1. When the Android build completes, you get a direct download link
2. Share this link with Ben and Robin
3. They can download and install directly (may need to enable "Unknown Sources")

## Quick Start Commands

```bash
# Set up environment
export PATH="/opt/homebrew/Cellar/node@22/22.22.0/bin:$PATH"
cd fahrbuch

# Login and configure (interactive)
npx eas-cli login
npx eas-cli build:configure

# Build for testing
npx eas-cli build --platform all --profile preview

# Check build status
npx eas-cli build:list

# View project details
npx eas-cli project:info
```

## Troubleshooting

### Common Issues:

1. **Authentication errors**: Run `npx eas-cli logout` then `npx eas-cli login`
2. **Build fails**: Check the build logs in the EAS dashboard
3. **iOS certificate issues**: Let EAS manage certificates automatically
4. **Android keystore issues**: Let EAS generate a new keystore

### Useful Commands:

```bash
# View all builds
npx eas-cli build:list

# View project info
npx eas-cli project:info

# Cancel a running build
npx eas-cli build:cancel <build-id>

# View build logs
npx eas-cli build:view <build-id>
```

## Next Steps

1. **Run the builds**: Follow steps 1-4 to create your builds
2. **Test installation**: Verify Ben and Robin can install and use the apps
3. **Iterate**: Make changes and rebuild as needed

The preview builds are perfect for MVP testing with shareable links that don't require app store approval.