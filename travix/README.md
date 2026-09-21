# 🚖 Travix2 — Smart Ride Booking Platform

A full-stack ride-hailing web application with live GPS tracking, smart group rides, driver matching, and an advanced safety system.

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Live GPS & Tracking** | Real-time driver location, route polyline, ETA countdown |
| 🚗 **Ride Booking** | Pickup → Destination → Ride type → Fare estimate → Confirm |
| 👤 **Driver Matching** | Driver receives request → accepts → arrives → PIN verify → ride starts |
| 👥 **Smart Group Rides** | Match riders with similar routes + gender composition display |
| 💳 **Payments & Receipts** | Fare calculation, card/cash/UPI/wallet, itemized receipts |
| 🛡️ **Safety System** | SOS alert, trusted contacts, route deviation & 10-min stop detection |

## 🛠️ Tech Stack

- **Frontend**: React 18 (Vite), Vanilla CSS, Leaflet.js
- **Backend**: Node.js + Express.js, Socket.IO
- **Database**: Supabase (PostgreSQL + Realtime)
- **Maps**: Leaflet.js + OpenStreetMap (free, no API key)

## 🚀 Getting Started

### 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Copy your Project URL and anon/service keys

### 2. Configure Environment

```bash
# Copy example env
cp server/.env.example server/.env

# Edit server/.env with your Supabase credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
CLIENT_URL=http://localhost:3000
```

Also create `client/.env`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install Dependencies

```bash
# Install all dependencies
cd client && npm install
cd ../server && npm install
```

### 4. Run the App

```bash
# Terminal 1: Start backend
cd server && npm run dev

# Terminal 2: Start frontend
cd client && npm run dev
```

App will be available at: http://localhost:3000

## 📁 Project Structure

```
travix2/
├── client/                  # React Vite frontend
│   ├── src/
│   │   ├── pages/           # All 12 pages
│   │   ├── components/      # Shared components
│   │   ├── context/         # Auth, Ride, Socket contexts
│   │   ├── services/        # API service layer
│   │   └── index.css        # Global design system
│   └── vite.config.js
├── server/                  # Node.js Express backend
│   ├── routes/              # API routes
│   ├── middleware/          # Auth middleware
│   ├── socket/              # Socket.IO handlers
│   ├── config/              # Supabase config
│   └── index.js             # Server entry
└── supabase/
    └── schema.sql           # Full database schema
```

## 🔑 Default Test Accounts

After setup, register two accounts:
1. **Rider**: Any email, role=rider
2. **Driver**: Any email, role=driver, add vehicle details

## 🛡️ Safety Features

- **SOS Button**: Always-visible floating button during rides. Tap → alerts all trusted contacts with GPS link
- **Trusted Contacts**: Up to 5 emergency contacts with name, phone, relationship
- **Auto Location Share**: Link sent to contacts when ride begins
- **Route Deviation**: Server monitors driver location every 30s against planned route
- **10-Minute Stop**: Alerts if vehicle speed < 2 km/h for 10+ minutes

## 📡 Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `auth:identify` | Client→Server | Authenticate socket connection |
| `ride:new_request` | Server→Drivers | Broadcast new ride request |
| `driver:location_update` | Driver→Server | GPS position update |
| `driver:location` | Server→Rider | Forwarded driver position |
| `ride:status_changed` | Server→Both | Ride status update |
| `safety:route_deviation` | Server→Both | Deviation alert |
| `safety:long_stop` | Server→Both | Stop alert |
| `safety:sos` | Client→Server | SOS trigger |

## 💰 Fare Calculation

```
fare = max(base_fare + (per_km × distance) + (per_min × duration), min_fare) × surge
```

| Type | Base | Per km | Per min | Min |
|---|---|---|---|---|
| Economy | ₹30 | ₹10 | ₹1.50 | ₹50 |
| Comfort | ₹50 | ₹14 | ₹2.00 | ₹80 |
| Premium | ₹80 | ₹20 | ₹3.00 | ₹120 |
| Group | ₹20 | ₹8 | ₹1.00 | ₹40 |
