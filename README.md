# AI Study Helper

An intelligent chatbot that analyzes study materials through images or text, providing comprehensive summaries and generating relevant study questions to enhance learning effectiveness.

## Demo

https://github.com/user-attachments/assets/d0182548-e70f-47f7-976c-e30348f2396b


## Project Structure
```
.
├── backend/          # FastAPI backend
│   ├── app/         # Application code
│   ├── requirements.txt
│   └── .env         # Environment variables
└── mobile/          # Expo mobile app
    ├── app/         # React Native components
    ├── package.json
    └── env.ts       # Environment configuration
```

## Setup & Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn
- Expo CLI

### Backend Setup

1. Create and activate virtual environment:
```bash
# Create virtual environment
python -m venv backend/api

# Activate virtual environment
# Windows
backend\api\Scripts\activate
# macOS/Linux
source backend/api/bin/activate
```

2. Install required packages:
```bash
cd backend
pip install -r requirements.txt
```

3. Create .env file:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Start the backend server:
```bash
uvicorn main:app --reload
```

### Mobile App Setup

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Configure environment:
```bash
# Update mobile/env.ts with your API URL
```

3. Start the mobile app:
```bash
npx expo start
```

## Development

### Running Tests
```bash
# Backend tests
cd backend
pytest

# Mobile tests
cd mobile
npm test
```

### Environment Variables
- Backend: Copy `.env.example` to `.env` and update values
- Mobile: Update `env.ts` with your configuration

## Deployment

### Backend
- Requires Python environment
- Set up environment variables
- Install production server (e.g., Gunicorn)

### Mobile
- Build using Expo CLI
- Deploy to App Store/Play Store
- Configure production API endpoints

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
