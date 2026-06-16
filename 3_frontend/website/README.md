# XCheck Frontend

X-style homepage mockup for misinformation intervention research.

## Setup (First Time Only)

### Windows
```powershell
.\setup.bat
```

### macOS / Linux
```bash
chmod +x setup.sh
./setup.sh
```

### Manual Setup
If scripts don't work, run these commands in this folder:
```bash
npm install
npm run compile
```

## Running the Server

After setup, start the development server:

```bash
npm start
```

Then open: **http://localhost:8000**

## What the Setup Does

1. **Installs Babel**: Converts JSX to plain JavaScript
2. **Compiles app.js**: Creates `app.compiled.js` from the readable JSX source
3. **No build complexity**: Just serve static files with Python

## File Structure

- `app.js` — Readable JSX source code (edit this)
- `app.compiled.js` — Auto-generated JavaScript (don't edit)
- `index.html` — Entry point
- `mock-data/posts.json` — Sample data
- `package.json` — Dependencies & scripts
- `.gitignore` — Excludes `node_modules` from git

## Troubleshooting

- **"npm not found"**: Install Node.js from nodejs.org
- **"python not found"**: Install Python or use `npx http-server` instead
- **Changes not showing**: Run `npm run compile` again after editing `app.js`

## Tech Stack

- React 18 (from CDN)
- Tailwind CSS (from CDN)
- Babel CLI (for local compilation)
- Plain HTTP server (Python)

No build tools. No complexity. Just works everywhere.
