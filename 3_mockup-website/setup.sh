#!/bin/bash
echo "Installing Babel dependencies..."
npm install

echo "Compiling JSX to JavaScript..."
npm run compile

echo ""
echo "Setup complete! To start the server:"
echo "  npm start"
echo ""
echo "Then open http://localhost:8000 in your browser."
