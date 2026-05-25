# 🚗 LC Rentals — Luxury & Exotics Rental Portal

A premium, high-fidelity luxury car rental web application designed with modern glassmorphic aesthetics, fluid micro-animations, an interactive Stripe checkout simulator (in AUD), and a comprehensive administrative management dashboard.

---

## ✨ Features

### 🌟 Phase 1: High-Fidelity Front-End Landing Page
* **Hero Section:** Sleek glassmorphic booking widget overlay with location, dates, and vehicle category select.
* **Dynamic Fleet Catalog:** Responsive fleet grid filterable by Category (Supercars, Hypercars, Luxury SUVs, Electric Exotics).
* **Detailed Vehicle Specification Modals:** Slide-out specifications and active lead inquiries form.
* **Lead Intake Manager:** Validates details, saves preferences, and prompts checkout registration.
* **FAQ Section:** Premium accordions answering all rental policy queries.

### 💳 Phase 2: Credentials Auth & Stripe AUD Booking Checkout
* **User Authentication:** Credentials sign-up and login stored securely in browser `localStorage`.
* **Stripe AUD Checkout Portal:** Mimics Stripe's dual-panel checkout window:
  * **Order Summary:** Displays itemized charges including Excess Protection options and GST.
  * **Payment & Terms:** Custom card validation inputs and electronic signature agreements.
  * **Invoicing:** Generates downloadable invoice sheets on successful completion.

### 📊 Phase 3: Fleet Management & Admin Console
* **Dashboard KPIs:** Live counters showing **Total Revenue**, **Occupancy Rate**, and **Active Fleet Status**.
* **Active Booking Logs:** Staff can approve, reject, start, or complete bookings.
* **Digital Inspection Checklists:** Interactive checkout & return checklists tracking body panels, fluid levels, tire pressures, and digital staff/client signatures.
* **Live Fleet Editor:** Admin forms to edit daily rates, add new vehicles, or toggle status to "Under Maintenance" (instantly updates the front-end catalog).

---

## 🛠️ Technology Stack
* **Framework:** React 19 + Vite 8
* **Styling:** Vanilla CSS 3 (curated HSL palettes, glassmorphism, custom scrollbars, typography, and responsive grids)
* **Icons:** Lucide React
* **Persistence:** Synchronized `localStorage` client-side databases

---

## 🚀 Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Verify Production Build:**
   ```bash
   npm run build
   npm run preview
   ```

---

## 🌐 Production Deployment Guide

This application is built as a static Single Page Application (SPA) and is fully configured for hosting. Direct page-refresh rewrites are pre-configured for each option.

### Option 1: Firebase Hosting (Classic) — [Recommended]

This project includes pre-configured `firebase.json` and `.firebaserc` files.

1. **Login to Firebase:**
   ```bash
   npx -y firebase-tools@latest login
   ```
2. **Associate with Your Project:**
   If you have a project ready, open `.firebaserc` and change `"lc-rentals-demo"` to your **Firebase Project ID**. Or, run:
   ```bash
   npx -y firebase-tools@latest use --add
   ```
3. **Deploy:**
   We have added a custom script to automate the build-and-deploy process:
   ```bash
   npm run deploy:firebase
   ```
   Or deploy manually:
   ```bash
   npx -y firebase-tools@latest deploy --only hosting
   ```

---

### Option 2: Vercel (Automatic GitHub CI/CD)

This project contains a `vercel.json` rewrite file to ensure SPA routing works seamlessly on reload.

#### A. Deployment via GitHub (Recommended)
1. Commit and push this codebase to a GitHub repository.
2. Go to [Vercel Dashboard](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. Set the **Framework Preset** to **Vite**.
5. Click **Deploy**. Vercel will build and deploy on every git push automatically!

#### B. Deployment via CLI
1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
2. Run the deployment wizard inside the directory:
   ```bash
   vercel
   ```
3. Promote to production:
   ```bash
   vercel --prod
   ```

---

### Option 3: Netlify (Automatic GitHub CI/CD)

This project contains a `netlify.toml` configuring the public directory `dist`, build command `npm run build`, and SPA redirects.

#### A. Deployment via GitHub (Recommended)
1. Commit and push this codebase to a GitHub repository.
2. Log in to [Netlify](https://netlify.com) and click **Add new site** -> **Import from Git**.
3. Select your GitHub repository.
4. The build settings are auto-loaded from `netlify.toml` (`Publish directory: dist`, `Build command: npm run build`).
5. Click **Deploy Site**.

#### B. Deployment via CLI
1. Install Netlify CLI globally:
   ```bash
   npm install -g netlify-cli
   ```
2. Run the deploy builder:
   ```bash
   netlify deploy --prod
   ```
