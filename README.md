# Vinyl TikTok

Infinite scroll webapp for vinyl/sample digger videos from curated YouTube channels.

## Features

- TikTok-style vertical infinite scroll
- Random shuffled videos from vinyl/sample digging channels
- Discogs integration - find the original vinyl release
- YouTube integration - open video on YouTube
- Smooth scrolling with instant video playback

## Channels

- Vinyle Archéologie
- Libraries Soul Tracks and Related
- André Navarro II
- Oleg Samples

## Usage

Simply open `index.html` in a browser. The app will fetch videos from the configured YouTube channels and display them in an infinite scroll format.

## Tech Stack

- Vanilla JavaScript
- YouTube Data API v3
- Discogs API

## API Keys

Edit `app.js` to configure:
- `YOUTUBE_API_KEY` - Your YouTube Data API key
- `DISCOGS_TOKEN` - Your Discogs API token
