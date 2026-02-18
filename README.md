# COSINT - Civic Open Source Intelligence Tool

<img width="1200" height="750" alt="image" src="https://github.com/user-attachments/assets/6aef0237-9e11-4c5e-a513-c50761699daf" />



COSINT (Civic Open Source Intelligence) is an AI-powered research tool for U.S. Congress. It gives everyday citizens the ability to look up their representatives track legislation, and undersatnd what's happening in Congress - all through a conversational chat interface. 

## What COSINT can do? 
- **Find Your Representatives** - Enter your address and instantly see your House rep and Senators
- **Research any member of Congress** - Look up voting records, sponsored bills, committee assignments, and biographical details for any current representative or senator
- **Read Bills in Plain English** - The app fetches raw legislative text and generates plain-language summaries to understand what's being voted on
- **Track Legislation** - Save and follow specific bills in your personal notebook with a drag-and-drop sidebar
- **AI-Powered Chat** - Ask natural language questions like "How did my senator vote on the latest defense bill?"
- **Research Notebook** - You can create and pin information to your note

**API Data Sources**: Congress, Google Civic Information, Brave Search 

There are:  
U.S. Congress Total: 535  
U.S. Senate: 100  
U.S. House of Representatives: 535  
Federal Legislation Bills Introduced (2025): 11,800 - 12,400  
Federal Legislation Bills Enacted (2025): 274 - 308  
State Legislations Introduced (2025): 135,500+  

Do you know any of them? Stay Informed with COSINT! 

**[Demo](https://practice-stack-neon.vercel.app/login)** 

## Technical Stuff

- `backend/`: FastAPI server with LangChain agent and Congress API integration.
- `frontend/`: Next.js web application with a modern chat interface.

## Quick Start

### 1. Setup Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Ensure your .env file is set up with CONGRESS_API_KEY and OPENAI_API_KEY
python3 -m uvicorn app.main:app --reload
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.
