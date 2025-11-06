BetBetter is a lightweight web app for comparing sports betting odds across sportsbooks.  
It normalizes data, calculates which sportsbook offers the best line, and visually highlights the best odds in a clean, responsive table.

### 1. Backend Setup
```bash
cd backend
npm install
npm start
Runs the backend server on http://localhost:3000.
The server also serves the frontend files automatically.

2. Frontend Access
Once the backend is running, open your browser and go to:
👉 http://localhost:3000

🧠 Project Structure
pgsql
Copy code
BetBetter/
│
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── data/mock_odds.json
│   │   └── utils/
│   │       ├── normalizeOdds.js
│   │       └── compareOdds.js
│   └── README.md
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
└── docs/
    ├── T3_odds_comparison.md
    ├── T6_highlighting_ui.md
    └── T7_documentation_updates.md