# FocusFlow

**FocusFlow** is a Chrome extension that transforms YouTube into a distraction-free, study-focused platform.  
It intelligently filters your feed to show only educational videos and blocks everything else — including Shorts, trends, and entertainment content.

---

## Features
- Smart keyword and channel-based content filtering  
- Password-protected Focus Mode  
- Optional Shorts blocking toggle  
- Clean, modern UI with lively animations  
- Persistent Chrome storage for settings  

---

## How It Works
FocusFlow continuously scans YouTube pages using a Mutation Observer and filters out any non-educational videos based on smart heuristics.  
It relies on:
- Educational keyword allowlists  
- Whitelisted learning channels  
- Entertainment keyword blacklists  

When Focus Mode is active, the feed refreshes automatically to show only educational videos. Shorts and distractions disappear instantly.

---

## Tech Stack
- JavaScript (Chrome Extension Manifest V3)  
- HTML, CSS  
- Chrome Storage API  
- Mutation Observers  

---

## Installation
1. Download or clone this repository:
   ```bash
   git clone https://github.com/ahmedakhtar-work/FocusFlow.git
2. Open Chrome and navigate to:
    chrome://extensions/
3. Turn on Developer mode (top right).
4. Click Load unpacked → select the FocusFlow folder.
5. Activate the extension and enjoy a cleaner, study-friendly YouTube.

[![Watch the demo](https://img.youtube.com/vi/ADcCURO9Evc/0.jpg)](https://youtu.be/ADcCURO9Evc)

   
