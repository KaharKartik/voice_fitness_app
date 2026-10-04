# Voice Gym Tracker

> Track every rep, own your progress — hands-free gym tracking powered by voice recognition.

![Voice Gym Tracker Screenshot](./screenshot.png)

## Overview

**Voice Gym Tracker** is a privacy-first fitness application that allows you to log sets instantly using natural spoken language or manual forms. Track your volume, observe long-term strength trends, maintain training streaks, and build customized weekly workout plans.

## Features

- **Voice Logging**: Log workouts using natural speech. Speak or type your set, review the parsed breakdown, and save with a single tap.
- **Manual Logging**: Traditional form interface supporting both free logging and prefilled exercises from your daily training plan.
- **Weekly Workout Plan**: Configure target exercises for each day of the week, toggle rest days, and manage uncommitted draft edits.
- **Interactive Dashboard**: View real-time totals including exercises done today, volume, current streak (skipping rest days), and weekly training days.
- **Progress Analytics**: Visual charts powered by Recharts for single exercise progression (Max Weight, Volume, Estimated 1RM) and whole workout volume.
- **Smart Insights**: Automated training feedback highlighting 30-day weight changes, plateau warnings, suggested next-session weights, and inactivity flags.
- **Exercise Normalization**: Automatic name formatting and deduplication across all logs, plans, and metrics.

## How Voice Logging Works

Voice logging uses Web Speech API recognition to transcribe speech into text and parse key workout attributes:

### Example Sentence
```text
"bench press, 3 sets, 8 reps, 60 kg"
```

The keyword parser extracts:
- **Exercise**: Bench Press
- **Sets**: 3
- **Reps**: 8
- **Weight**: 60 kg

> **Browser Note**: Voice speech-to-text recognition works best in **Google Chrome**.

## Built With Wispr Flow

This project was built using **Wispr Flow** voice dictation for hands-free productivity and rapid UI/UX iteration.

## Tech Stack

- **React 18** — Component-driven frontend architecture
- **Vite** — Lightning-fast local development server and build pipeline
- **Recharts** — Responsive charting library for progress visualization
- **Web Speech API** — Browser-native speech recognition
- **HTML5 / Vanilla CSS** — Custom HSL design tokens, dynamic cards, and micro-animations
- **localStorage** — Client-side persistent data storage

## Privacy & Local Storage

All workout data, plans, and settings are stored **100% locally in your browser** (`localStorage`). No user account, registration, backend server, or internet connection is required to use the app.

## Run Locally

Follow these steps to run Voice Gym Tracker on your local machine:

1. **Clone the repository** (or navigate to the project directory):
   ```bash
   cd voice_fitness_app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:5173` (or the URL printed in your terminal).
