# Zerra (CtrlVibes)

Zerra is a high-fidelity, professional surplus redistribution and inventory management platform designed to connect premium food purveyors (restaurants, product sellers, cloud kitchens) with strategic community partners (NGOs, shelters, and eco-conscious consumers). Built with a modern "Flat-Enterprise" aesthetic, Zerra modernizes the redistribution process through real-time logistics, advanced AI analytics, expiry tracking, and immersive tracking.

## 🚀 Key Features

### 1. Multi-Role Ecosystem
- **NGO**: Receives priority alerts for surplus food and can claim donations seamlessly.
- **Restaurant**: Frictionless surplus orchestration for cooked meals, tracking redistribution impact.
- **Product Seller**: Manages packed goods, uses the AI scanner for expiry tracking, and pushes near-expiry products to the marketplace automatically.
- **Consumer**: Hyper-local surplus discovery with Zepto-style tracking and a robust complaint/support system.

### 2. AI-Powered Inventory Intelligence (The Vault)
- **Vision AI Expiry Scanner**: Integrates NVIDIA's Llama 3.2 90B Vision Instruct model to automatically read product packaging, extracting names, brands, quantities, barcodes, and expiry dates from photos.
- **Real-Time Barcode Scanning**: Uses the Open Food Facts API alongside `html5-qrcode` to instantly fetch product data globally.
- **Smart Categorization**: Automatically flags items as 'Safe', 'Warning', 'Critical', or 'Expired'. Items nearing expiry are automatically pushed to the live marketplace with discount alerts sent to consumers and NGOs.
- **Batch Processing**: Rapidly scan and add multiple items to the inventory vault.

### 3. Institutional Dashboard & Marketplace
- **Pro-Map Overview**: Interactive Leaflet-based dashboard featuring CartoDB mapping, nearby purveyor discovery, and live heatmaps for surplus density.
- **High-Efficiency Marketplace**: Robust filtering for different food categories (Cooked vs. Packed) and urgency levels.

### 4. Immersive Live Tracking & Logistics
- **Handoff Verification**: Secure QR-code/Secret based handoff system between sellers and NGO partners.
- **Real-Time Progress**: Full-screen tracking interface with live progress bars and dynamic map routing.

### 5. Advanced Impact Analytics & Support
- **Sustainability Dashboard**: High-fidelity data visualization using Recharts, detailing redirected weight, value recovered, and fuel saved through dynamic temporal growth reports.
- **Consumer Integrity Protection**: A specialized module restricted to **Consumer** roles. Features an official report filing system with:
    - **Order Integration**: Direct linking of complaints to purchase history.
    - **Evidence Capture**: Multi-source evidence upload (Gallery/Camera).
    - **Official Dispatch**: Automated simulation of email reports sent to compliance administrators (`varunsugandhi11@gmail.com`).
    - **Case Tracking**: Unique case IDs (e.g., `ZC-XXXXXX`) for every submission.
- **Role-Based Access Control (RBAC)**: Intelligent UI masking that ensures "Consumer Integrity" features are only visible and accessible to verified Consumer accounts, maintaining platform security and role-specific workflows.

## 🛠️ Technology Stack

- **Frontend Core**: React 19 + Vite
- **Backend & Auth**: Supabase (PostgreSQL, Realtime, Storage)
- **AI Integration**: NVIDIA AI Endpoints (Llama 3.2 Vision)
- **Product Data API**: Open Food Facts (OFF) API
- **Styling**: Tailwind CSS (Eco-Luxe Design System) + Framer Motion for animations
- **Mapping**: React-Leaflet + Leaflet + CartoDB Positron
- **Charts**: Recharts
- **Icons & Scanning**: Material Symbols (Google), `html5-qrcode`, `react-qr-reader`

## 📁 Project Structure

- `src/pages/`: Modular page components (Dashboard, Inventory, Marketplace, Profile, Support, etc.)
- `src/components/`: Reusable UI elements (Navbar, Modals, Status Overlays, Camera integrations)
- `src/supabaseClient.js`: Supabase connection configuration
- `src/App.jsx`: Centralized routing and navigation architecture

## 🏁 Getting Started

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up Environment Variables**:
   Create a `.env` file in the root directory and configure your keys:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```

---
*Zerra: Rescuing Surplus. Empowering Communities.*
