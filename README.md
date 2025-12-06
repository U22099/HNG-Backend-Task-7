# AI Document Summarization + Metadata Extraction Service

A NestJS-based backend that accepts PDF or DOCX files, extracts text, sends it to an LLM on OpenRouter, and returns a concise summary, detected document type, and extracted metadata.

---

## Features

- **File Upload**: Accept PDF and DOCX files (max 5MB)
- **Text Extraction**: Automatically extract text from uploaded documents
- **S3/Minio Storage**: Store raw files in S3-compatible storage
- **AI Analysis**: Send extracted text to OpenRouter LLM API
- **Metadata Extraction**: Detect document types and extract key information
- **Database Storage**: Save all data using Prisma ORM

---

## Quick Start

### Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- Node.js 18+

### 1. Start Minio (S3) with Docker Compose

**Windows:**
```cmd
scripts\setup-dev.bat
```
**macOS/Linux:**
```bash
bash scripts/setup-dev.sh
```
Or manually:
```bash
docker-compose up -d
```

Access Minio Console at [http://localhost:9001](http://localhost:9001)
- Username: `minioadmin`
- Password: `minioadmin`

The bucket `documents` should be auto-created.

### 2. Install Dependencies & Start Backend
```bash
npm install
npm run start:dev
```
API available at [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

`.env` example:
```env
DATABASE_URL="file:./dev.db"
S3_ENDPOINT=http://localhost:9000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=documents
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=gpt-3.5-turbo
PORT=3000
NODE_ENV=development
```

---

## API Endpoints

### 1. Upload Document
**POST** `/documents/upload`
- Content-Type: `multipart/form-data`
- Field name: `file`
- Max size: 5MB
- Supported: PDF, DOCX

**Response:**
```json
{
  "id": "uuid-of-document",
  "originalName": "invoice.pdf",
  "mimeType": "application/pdf",
  "size": 125000,
  "createdAt": "2025-12-06T10:00:00.000Z"
}
```

### 2. Analyze Document
**POST** `/documents/{id}/analyze`
- `id`: Document ID from upload response

**Response:**
```json
{
  "id": "uuid-of-document",
  "summary": "This is an invoice from ABC Corp dated December 1, 2025 for $5,000.",
  "docType": "invoice",
  "attributes": {
    "date": "December 1, 2025",
    "sender": "ABC Corp",
    "recipient": "Your Company",
    "totalAmount": "$5,000",
    "subject": "Invoice #12345"
  }
}
```

### 3. Get Document
**GET** `/documents/{id}`
- `id`: Document ID from upload response

**Response:**
```json
{
  "id": "uuid-of-document",
  "originalName": "invoice.pdf",
  "mimeType": "application/pdf",
  "size": 125000,
  "extractedText": "Invoice #12345...",
  "summary": "This is an invoice from ABC Corp...",
  "docType": "invoice",
  "metadata": {
    "date": "December 1, 2025",
    "sender": "ABC Corp",
    "recipient": "Your Company",
    "totalAmount": "$5,000",
    "subject": "Invoice #12345"
  },
  "createdAt": "2025-12-06T10:00:00.000Z",
  "updatedAt": "2025-12-06T10:05:00.000Z"
}
```

---

## Testing the Workflow

### Upload a PDF/DOCX
```bash
curl -X POST http://localhost:3000/documents/upload \
  -F "file=@/path/to/document.pdf"
```

### Analyze the Document
```bash
curl -X POST http://localhost:3000/documents/<id>/analyze
```

### Get Full Document Data
```bash
curl http://localhost:3000/documents/<id>
```

---

## Docker & Minio Management

### View Running Containers
```bash
docker-compose ps
```
### View Minio Logs
```bash
docker-compose logs -f minio
```
### Stop Containers
**Windows:**
```cmd
scripts\teardown-dev.bat
```
**macOS/Linux:**
```bash
docker-compose down
```
### Clean Up Everything (including volumes)
```bash
docker-compose down -v
```

---

## Troubleshooting

- **Minio not starting:** Ensure ports 9000/9001 are free, Docker is running, view logs with `docker-compose logs minio`.
- **Connection refused:** Wait 5-10 seconds after starting Minio, check `S3_ENDPOINT` in `.env`.
- **Bucket doesn't exist:** Bucket is auto-created by `minio-init` service. If missing, run `docker-compose up -d minio-init`.
- **Port Already in Use:** Change ports in `docker-compose.yml` and update `.env`.
- **File size must not exceed 5MB:** Compress or split the document.
- **Only PDF and DOCX files are supported:** Ensure correct MIME type.
- **Failed to connect to S3:** Check endpoint and credentials.
- **Failed to analyze document with LLM:** Check OpenRouter API key and credits.
- **No extracted text found:** Try a different document.

---

## Project Structure

```
src/
├── documents/
│   ├── documents.controller.ts     # API endpoints
│   ├── documents.service.ts        # Main business logic
│   ├── documents.module.ts         # Module definition
│   ├── s3.service.ts              # S3/Minio storage service
│   ├── text-extraction.service.ts # PDF/DOCX text extraction
│   └── openrouter.service.ts      # LLM API integration
├── prisma/
│   └── prisma.service.ts          # Prisma client service
├── app.module.ts                   # Main application module
├── app.controller.ts
├── app.service.ts
└── main.ts
prisma/
└── schema.prisma                   # Database schema
```

---

## Database Schema

```prisma
model Document {
  id            String   @id @default(uuid())
  originalName  String
  mimeType      String
  size          Int
  s3Key         String
  extractedText String?
  summary       String?
  docType       String?
  metadata      String?  // JSON stored as string
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

## Supported Document Types

- **invoice**: Invoices and billing documents
- **cv**: Curriculum Vitae / Resume
- **report**: Reports and analysis documents
- **letter**: Letters and correspondence
- **contract**: Contracts and agreements
- **email**: Email messages
- **other**: Unclassified documents

---

## Extracted Metadata

Depending on document type, the following metadata is extracted:
```json
{
  "date": "Document date if available",
  "sender": "Author/sender of document",
  "recipient": "Intended recipient",
  "totalAmount": "Financial amount if applicable",
  "subject": "Document subject or title"
}
```

---

## Error Handling

API returns appropriate HTTP status codes and error messages.

---

## Performance Considerations

- **File Size Limit:** 5MB maximum
- **Text Extraction:** Limited to first 8000 characters for LLM
- **Concurrent Requests:** Supported
- **Database:** SQLite for dev; use PostgreSQL for prod

---

## Technologies Used

- **NestJS**
- **Prisma ORM**
- **AWS SDK v3**
- **pdf-parse**
- **mammoth**
- **axios**
- **TypeScript**

---

## Next Steps

1. Start Docker: `scripts\setup-dev.bat`
2. Install dependencies: `npm install`
3. Start the app: `npm run start:dev`
4. Test endpoints (see above)

