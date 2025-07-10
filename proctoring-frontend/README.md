# AI Proctoring Frontend

This is the frontend for the AI Proctoring System, an advanced web application built with Angular. It provides real-time monitoring of users during online assessments to ensure academic integrity.

## Overview

The application uses the computer's webcam and microphone to monitor the user's activity. It leverages machine learning models running directly in the browser to perform face detection, voice activity detection, and speech-to-text transcription. The system can identify and flag potential cheating behaviors, such as the presence of multiple people, looking away from the screen, or speaking prohibited words.

## Key Features

- **Real-time Face Detection:** Detects the number of faces in the camera feed and their orientation.
- **Voice Activity Detection (VAD):** Monitors microphone input to detect when the user is speaking.
- **Speech-to-Text:** Transcribes the user's speech in real-time to identify prohibited words.
- **Screen Recording:** Records the user's screen during the proctoring session.
- **Violation Detection:** Flags violations based on configurable rules (e.g., multiple faces, looking away, prohibited words).
- **Modern UI:** A clean, responsive, and high-contrast user interface for a professional presentation.

## Technology Stack

- **Angular:** A powerful framework for building dynamic single-page applications.
- **TypeScript:** A typed superset of JavaScript that enhances code quality and maintainability.
- **face-api.js:** A JavaScript API for face detection and face recognition in the browser.
- **Pusher-js:** For real-time communication with the backend.
- **WebRTC:** For accessing the user's camera, microphone, and screen.

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd proctoring-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Running the Application

1. **Start the development server:**
   ```bash
   npm start
   ```
   This will start the Angular development server. The application will be available at `http://localhost:4200/`.

2. **Backend Server:**
   Make sure the corresponding Laravel backend server is running, as the frontend will make API calls to it.

## Build Process

To create a production-ready build of the application, run:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

```
proctoring-frontend/
├── src/
│   ├── app/
│   │   ├── proctoring/         # Main proctoring component
│   │   │   ├── proctoring.component.ts
│   │   │   ├── proctoring.component.html
│   │   │   └── proctoring.component.css
│   │   ├── services/           # Services for business logic
│   │   │   ├── face-detection.service.ts
│   │   │   ├── voice-detection.service.ts
│   │   │   ├── screen-recording.service.ts
│   │   │   └── proctoring.service.ts
│   │   └── ...
│   ├── assets/                 # ML models and other static assets
│   └── ...
├── angular.json              # Angular project configuration
├── package.json                # Project dependencies and scripts
└── README.md                   # This file
```