#!/bin/bash
# Eco Forecast — Start both backend and frontend
set -e

echo "⚡ Starting Eco Forecast..."

# Start backend
echo "Starting FastAPI backend on :8000..."
cd "$(dirname "$0")/backend"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait a moment for backend to initialise
sleep 3

# Start frontend
echo "Starting Next.js frontend on :3000..."
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Eco Forecast is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait for Ctrl+C, then kill both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
