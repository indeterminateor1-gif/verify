# 🚀 Event QR Verification Web App & Google Sheets Automation

A complete, production-ready event gate verification system built for GitHub and 100% free hosting on **Vercel**.

---

## 📁 Project Directory Structure

```text
event-verification-system/
├── index.html        # Main SPA scanner app & status redirect pages
├── style.css         # Glassmorphic Dark & Light theme stylesheet
├── app.js            # Scanner engine, linear ID duplicate checker & safe backup
├── vercel.json       # Vercel static routing configuration
├── Code.gs           # Google Apps Script for automated ticket email sending
└── README.md         # Documentation & setup guide
```

---

## 🌟 Key Application Features

1. **📷 Live Inline View Redirects (Zero Audio)**:
   - **🟢 Verified (First Scan)**: Full lush green screen, large green tick mark icon, attendee ticket details, and a prominent **"Scan Next Ticket"** button.
   - **🩶 QR Already Scanned (Duplicate Scan)**: Full slate gray screen, "QR ALREADY SCANNED" warning, original arrival timestamp, total scan attempts, and **"Scan Next Ticket"** button.
   - **🔴 Invalid Format**: Red warning screen for unreadable QR codes.

2. **☰ Top Admin 3-Bars Hamburger Menu**:
   - **🌓 Light / Dark Mode Toggle**: Instant theme switching across all views.
   - **📥 Export Log Activity**: Downloads complete check-in log as a `.csv` file.
   - **🔄 Safe Reset Activity**: Resets data for a fresh new event session.
     - **Zero Data Loss Guarantee**: Automatically triggers a CSV backup download of all current data *before* clearing memory!

3. **📝 Hidden Linear Text Notes State**:
   - Space-separated Ref IDs stored in memory & background textareas: `LDVI1 Y5B5A SUB-1001`
   - Space-separated timestamps stored in memory & background textareas: `LDVI1@2026-10-04T06:30:00 Y5B5A@2026-10-04T06:31:15`

---

## 🐙 How to Upload to GitHub & Host on Vercel

### Step 1: Upload to GitHub
1. Create a new repository on [GitHub](https://github.com/new) (e.g. `event-qr-verifier`).
2. Open terminal inside `C:\Users\91911\.gemini\antigravity\scratch\event-verification-system` and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Event QR Verifier"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/event-qr-verifier.git
   git push -u origin main
   ```

### Step 2: Host on Vercel (100% Free)
1. Go to [Vercel.com](https://vercel.com/new).
2. Click **Import Repository** and select your `event-qr-verifier` GitHub repository.
3. Keep default settings and click **Deploy**.
4. Vercel will give you a live production URL (e.g. `https://event-qr-verifier.vercel.app`).
5. Open this link on smartphones or tablets at your event gate!

---

## 📊 Google Sheets Setup (`Code.gs`)

1. Open your Google Sheet -> **Extensions** -> **Apps Script**.
2. Copy the code from [Code.gs](./Code.gs) into your Apps Script editor.
3. Run `setupInstallableTrigger()` once to authorize automatic email sending whenever Column M (`Verify`) is edited to `Verified`.
