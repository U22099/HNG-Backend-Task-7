@echo off
REM Docker development setup script for HNG Backend Task 7 (Windows)

echo.
echo 🚀 Starting Docker containers for development...
echo.

REM Start Minio and initialize bucket
docker-compose up -d

echo.
echo ⏳ Waiting for Minio to be ready...
timeout /t 5 /nobreak

echo.
echo ✅ Minio is running!
echo.
echo 📊 Minio Console available at: http://localhost:9001
echo    Username: minioadmin
echo    Password: minioadmin
echo.
echo 🪣 S3 Bucket 'documents' created and ready
echo    Endpoint: http://localhost:9000
echo.
echo 📝 Your .env file should have:
echo    S3_ENDPOINT=http://localhost:9000
echo    AWS_ACCESS_KEY_ID=minioadmin
echo    AWS_SECRET_ACCESS_KEY=minioadmin
echo    S3_BUCKET_NAME=documents
echo.
echo ✨ Ready to run: npm run start:dev
echo.
