@echo off
REM Teardown Docker development environment (Windows)

echo.
echo 🛑 Stopping Docker containers...
echo.

docker-compose down

echo.
echo ✅ Docker containers stopped
echo.
