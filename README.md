# CampusPass — College Event & Ticketing Platform

A production-style mobile-first college event discovery and ticketing platform built with React, Vite, TypeScript, Tailwind CSS, Lucide icons, Canvas Confetti, and QR code token verification.

---

## 🌟 Architecture & Key Features

### 1. Dual Role Access Control
- **Student / User Role**:
  - Discover trending college fests, concerts, hackathons, and symposiums.
  - Search by title, venue, or host organizer.
  - Interactive category and price range filters (Free, Under ₹100, ₹100–₹300, ₹500+).
  - Real-time seat availability indicator with capacity progression bar.
  - Simulated UPI Checkout (Google Pay, PhonePe, Paytm, Custom UPI ID).
  - Server-side signature validation and atomic ticket inventory decrement.
  - E-Ticket generation with unique QR code, token hash, perforated ticket card design, and download/share actions.
  - My Tickets view separated into Active/Upcoming and Completed/Past passes.

- **Organizer / Host Role**:
  - Complete Host Dashboard with key metrics (Total Events, Tickets Sold, Total Settled Revenue, Gate Attendance).
  - Real-time Gate Scanner with device camera support and fast test-simulation selector.
  - Gate dual-mode: **Entry Mode** vs **Exit Mode**.
  - Duplicate scan prevention: rejects re-entry of previously entered tickets with exact entry timestamp.
  - Tamper detection: rejects fake/invalid QR codes.
  - Attendee Ledger: search attendees, filter by Entered, Not Entered, or Exited status.
  - Event Management: create, edit, draft, publish, or cancel college events with custom capacity, pricing, and perks.

---

## 🛡️ Payment & Security Architecture

1. **Zero Client Trust**: The frontend never creates a confirmed ticket.
2. **Atomic Concurrency**: Inventory checks (`availableTickets > 0`) decrement available tickets and increment tickets sold atomically.
3. **Cryptographic Tokens**: Tickets use hashed tokens (`sha256` payload) rather than raw sensitive personal data inside the QR.
4. **Gate Replay Protection**: Scanned tickets record server timestamp; re-scans are instantly blocked with a `TICKET ALREADY USED` alert.
