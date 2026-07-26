# Phone Store Management

## Gemini và Google Sheets

### 1. Tạo Gemini API key

Tạo API key trong Google AI Studio.

### 2. Thiết lập biến môi trường

Sao chép:

```bash
cp .env.example .env.local
```

Điền các biến:

```env
GEMINI_API_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
CRON_SECRET=
```

### 3. Chia sẻ Google Sheet

Chia sẻ Google Sheet cho email service account với quyền Viewer hoặc cao hơn theo nhu cầu hệ thống hiện tại.

### 4. Kiểm tra

Chạy project và gọi endpoint kiểm tra Gemini:

```bash
pnpm test:gemini
```

Hoặc mở:

- `GET /api/ai/test`
- `GET /api/google-sheets/test`

Không commit `.env.local`.
