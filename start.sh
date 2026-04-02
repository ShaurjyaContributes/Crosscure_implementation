#!/bin/bash
# CrossCures — Start both backend and frontend

echo "🚀 Starting CrossCures..."

# Start backend
echo "Starting backend on port 8000..."
cd "$(dirname "$0")/backend"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Wait for backend
sleep 3

# Start frontend  
echo "Starting frontend on port 3000..."
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ CrossCures is running!"
echo "   Patient / Physician App: http://localhost:3000"
echo "   API Docs:                http://localhost:8000/docs"
echo ""
echo "Demo accounts:"
echo "   Patient:    patient@demo.com / demo1234"
echo "   Physician:  physician@demo.com / demo1234"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit 0" INT
wait
