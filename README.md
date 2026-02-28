# Fahrbuch - German Mileage Logbook App

A React Native / Expo app for automatic trip detection and mileage logging, designed for German freelancers and contractors who need Finanzamt-compliant trip records.

## 🚗 What is Fahrbuch?

Fahrbuch automatically detects when you're driving using your phone's motion sensors and GPS. It silently tracks trips in the background and sends you a notification when a trip ends, allowing you to tag it as business, private, or commute with just one tap.

## ✨ Key Features

### Current (Proof of Concept)
- **Automatic trip detection** using activity recognition and GPS
- **Background location tracking** with battery optimization
- **Speed-based vehicle detection** (>15 km/h sustained)
- **Smart trip ending** when stationary for 30+ seconds
- **One-tap trip tagging** via push notifications
- **Trip history** with distance and duration

### Planned Features
- **Finanzamt-compliant PDF export**
- **CSV export** for spreadsheets
- **Home/Work address setup** for better categorization
- **Bluetooth car pairing** for improved accuracy
- **Monthly summaries** and tax calculations
- **Multi-vehicle support**

## 🏗️ Tech Stack

- **Frontend:** React Native with Expo
- **Backend:** Flask API (planned)
- **Database:** SQLite local + PostgreSQL remote (planned)
- **Maps:** React Native Maps
- **Location:** Expo Location API
- **Sensors:** Expo Sensors for activity recognition

## 📱 Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (macOS) or Android emulator

### Installation

1. Clone and enter the project:
   ```bash
   cd fahrbuch
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Run on device/simulator:
   ```bash
   npm run ios    # iOS simulator
   npm run android # Android emulator
   ```

### Required Permissions

The app requires these permissions to function:

- **Location (Always):** Essential for trip detection
- **Motion & Fitness:** For vehicle activity recognition  
- **Notifications:** For trip tagging prompts

⚠️ **Note:** Activity recognition works best on real devices. The simulator version includes activity simulation for demo purposes.

## 🧠 How Trip Detection Works

### 1. Motion Analysis
- Uses device accelerometer and gyroscope
- Calculates motion variability patterns
- Distinguishes between walking, cycling, and driving

### 2. Speed Validation
- GPS speed monitoring every 5 seconds
- Vehicle detected when speed > 15 km/h sustained
- Filters out trains/buses using speed pattern analysis

### 3. Trip Boundaries
- **Trip Start:** Vehicle activity + speed >10 km/h for 30+ seconds
- **Trip End:** Speed <5 km/h + stationary for 3+ minutes
- **Minimum Distance:** 500m filter to ignore short movements

### 4. Smart Features
- Geofencing around home/work reduces battery drain
- Multi-stop detection: asks if still on same trip
- Passenger detection via Bluetooth car pairing (planned)

## 📊 Project Status

**Phase 1: ✅ COMPLETE**
- [x] Project setup and structure
- [x] Activity recognition proof-of-concept
- [x] Basic trip detection logic
- [x] Permissions framework
- [x] Demo UI with trip history

**Phase 2: 🚧 IN PROGRESS**
- [ ] Local SQLite storage
- [ ] Enhanced notification system
- [ ] Background task optimization
- [ ] Address geocoding improvements

**Phase 3: 📅 PLANNED**
- [ ] Main dashboard UI
- [ ] Trip detail screens
- [ ] Manual trip editing
- [ ] Settings and preferences

**Phase 4: 📅 PLANNED**  
- [ ] PDF export (Finanzamt format)
- [ ] CSV export
- [ ] User onboarding flow
- [ ] Car pairing setup

**Phase 5: 📅 PLANNED**
- [ ] Backend API integration
- [ ] User authentication
- [ ] Cloud sync
- [ ] Production testing

## 🛠️ Development

### Project Structure

```
fahrbuch/
├── src/
│   ├── components/     # Reusable UI components
│   ├── screens/        # App screens
│   ├── services/       # Business logic
│   ├── types/          # TypeScript definitions
│   ├── utils/          # Helper functions
│   └── hooks/          # Custom React hooks
├── assets/             # Images, fonts, etc.
└── README.md
```

### Key Services

- **ActivityService:** Motion detection and activity recognition
- **TripService:** Trip management and orchestration
- **LocationService:** GPS tracking and geocoding (planned)
- **NotificationService:** Push notifications (planned)
- **StorageService:** Local data persistence (planned)

### Testing Strategy

1. **Unit Tests:** Service logic and utilities
2. **Integration Tests:** Service interactions  
3. **Real Device Testing:** Essential for accurate motion detection
4. **Edge Case Testing:** Passenger scenarios, train rides, short trips

## 🇩🇪 German Compliance

The app is designed to meet German tax authority (Finanzamt) requirements:

- **Complete trip records:** Start/end addresses, distance, duration
- **Business purpose documentation:** Notes field for client details
- **Proper date formatting:** German locale
- **PDF export format:** Matches Finanzamt expectations
- **Data privacy:** GDPR compliant (local-first storage)

## 🚀 Deployment

### Development
- Expo Go app for quick testing
- Development builds for device testing

### Production (Planned)
- App Store Connect (iOS)
- Google Play Console (Android)  
- Backend on Render (Frankfurt region)

## 📈 Success Metrics

- **Accuracy:** >95% correct trip detection
- **Battery Impact:** <5% additional drain per driving hour
- **User Experience:** <3 taps to tag a trip
- **Compliance:** Finanzamt-accepted export format

## 🤝 Contributing

This is currently a proof-of-concept. The next steps involve:

1. Real device testing and motion detection refinement
2. Local database implementation
3. UI/UX improvements based on user feedback

## 📄 License

TBD - This is a commercial product in development.

---

**Questions about implementation?**
- German UI vs English UI?
- Target DACH region (Germany/Austria/Switzerland)?
- MVP timeline?
- Customer support strategy?