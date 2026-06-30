#!/bin/bash
echo "========================================"
echo "  Ping Monitor - Starting Server"
echo "========================================"
echo ""
echo "Server will be available at:"
echo "  http://localhost:8000"
echo ""
echo "Other devices on your network can access:"
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null)
echo "  http://${IP}:8000"
echo ""
echo "Press Ctrl+C to stop the server."
echo "========================================"
echo ""
cd "$(dirname "$0")/backend"
python3 main.py
