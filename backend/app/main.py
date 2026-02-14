import os
import requests
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Tuple
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import get_db, init_db, Conversation, Message, SessionLocal, TrackedBill, ResearchNote
from .services.cosint.agent import get_cosint_agent
from jose import jwt
import os
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="COSINT API")

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class NoteCreate(BaseModel):
    title: str
    content: str

class ConversationUpdate(BaseModel):
    title: str

# JWT Verification Logic using JWKS (Supports ES256)
# Cache for JWKS to avoid fetching on every request
_jwks_cache = None

def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        if not supabase_url:
            raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
            
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        try:
            response = requests.get(jwks_url)
            response.raise_for_status()
            _jwks_cache = response.json()
        except Exception as e:
            print(f"Failed to fetch JWKS from {jwks_url}: {e}")
            raise HTTPException(status_code=500, detail="Internal authentication error")
    return _jwks_cache

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split(" ")[1]
    try:
        # 1. Get the Key ID (kid) from the token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        # 2. Get the corresponding public key from JWKS
        jwks = get_jwks()
        key_json = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        
        if not key_json:
            # Refresh cache and try again once if key not found
            global _jwks_cache
            _jwks_cache = None
            jwks = get_jwks()
            key_json = next((k for k in jwks["keys"] if k["kid"] == kid), None)
            
        if not key_json:
            raise HTTPException(status_code=401, detail="Invalid token: unknown key ID")

        # 3. Verify the token using the public key
        payload = jwt.decode(
            token, 
            key_json, 
            algorithms=["ES256", "HS256"], 
            audience="authenticated"
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except Exception as e:
        print(f"JWT Verification Failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

# Initialize database tables on startup
@app.on_event("startup")
def startup_event():
    init_db()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"],
)

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    initial_context: Optional[str] = None
    bioguide_id: Optional[str] = None

@app.post("/conversations")
async def create_conversation(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = Conversation(title="New Chat", user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": str(conv.id), "title": conv.title}

@app.get("/conversations/member/{bioguide_id}")
async def get_member_conversation(bioguide_id: str, name: Optional[str] = None, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Find existing conversation for this member
    conv = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.bioguide_id == bioguide_id
    ).first()
    
    if conv:
        # If title is generic, update it with the name if provided
        if name and (conv.title.startswith("Briefing:") or conv.title == "New Chat"):
            conv.title = name
            db.commit()
        return {"id": str(conv.id)}
    
    # Create new one if not exists
    new_conv = Conversation(
        title=name or f"Briefing: {bioguide_id}",
        user_id=user_id,
        bioguide_id=bioguide_id
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return {"id": str(new_conv.id)}

@app.get("/conversations")
async def list_conversations(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only return conversations linked to a specific representative (Notebook Sessions)
    conversations = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.bioguide_id.isnot(None)
    ).order_by(Conversation.created_at.desc()).all()
    return [{"id": str(c.id), "title": c.title, "created_at": c.created_at, "bioguide_id": c.bioguide_id} for c in conversations]

@app.patch("/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, update: ConversationUpdate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv.title = update.title
    db.commit()
    db.refresh(conv)
    return conv

@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"status": "success"}

@app.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify conversation belongs to user or is public/legacy
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.user_id and str(conv.user_id) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    return [{"role": m.role, "content": m.content} for m in messages]

@app.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Ensure conversation exists and belongs to user
    if not request.conversation_id:
        conv = Conversation(
            title=request.message[:30] + "...", 
            user_id=user_id
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conv_id = str(conv.id)
    else:
        conv_id = request.conversation_id
        conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
        
        # Security: ensure user owns this conversation
        # We allow access if the conversation has no user_id (legacy) or matches the current user
        if conv and conv.user_id and str(conv.user_id) != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        if conv.title == "New Chat":
            conv.title = request.message[:30] + "..."
            db.commit()

    # 2. Get history from DB
    db_messages = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at.asc()).all()
    history = [(m.role, m.content) for m in db_messages]

    # 3. Save user message to DB
    user_msg = Message(conversation_id=conv_id, role="human", content=request.message)
    db.add(user_msg)
    db.commit()

    async def event_generator():
        try:
            agent_executor = get_cosint_agent(streaming=True)
            full_response = ""
            
            # Use astream_events to capture tokens
            async for event in agent_executor.astream_events(
                {
                    "input": request.message, 
                    "chat_history": history,
                    "context": request.initial_context or "General inquiry mode."
                },
                version="v2"
            ):
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        full_response += content
                        yield content
                elif kind == "on_tool_start":
                    tool_name = event['name']
                    source = "external sources"
                    if "congress" in tool_name or "member" in tool_name:
                        source = "Congress.gov"
                    elif "address" in tool_name or "civic" in tool_name:
                        source = "Google Civic Data"
                    elif "search" in tool_name:
                        source = "Brave Web Search"
                    yield f"\n\n*Accessing information from {source}...*\n\n"

            # 4. Intel Extraction Step (The Second Agent)
            try:
                from .services.cosint.agent import get_intel_extraction_agent
                extraction_agent = get_intel_extraction_agent()
                intel = await extraction_agent.ainvoke({"response": full_response})
                
                if intel.is_useful:
                    # Use a unique terminator to prevent Markdown links from breaking the tag
                    packet_tag = f"\n\n[INTEL_PACKET: {intel.title} | {intel.content} |END_PACKET]"
                    yield packet_tag
                    # Append to full_response so it gets saved to DB
                    full_response += packet_tag
            except Exception as e:
                print(f"Intel extraction failed: {e}")

            # 5. Save assistant message to DB after stream finishes
            with SessionLocal() as save_db:
                assistant_msg = Message(conversation_id=conv_id, role="assistant", content=full_response)
                save_db.add(assistant_msg)
                
                # CHECK FOR BILL TRACKING: Format: [TRACK_BILL: Congress | Type | Number | Title]
                track_match = re.search(r"\[TRACK_BILL:\s*(\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^\]]+)\]", full_response)
                if track_match:
                    congress = int(track_match.group(1))
                    bill_type = track_match.group(2).strip()
                    bill_number = track_match.group(3).strip()
                    title = track_match.group(4).strip()
                    bill_id = f"{congress}-{bill_type}-{bill_number}".lower()
                    
                    # Check if already tracked
                    existing = save_db.query(TrackedBill).filter(
                        TrackedBill.user_id == user_id,
                        TrackedBill.bill_id == bill_id
                    ).first()
                    
                    if not existing:
                        new_track = TrackedBill(
                            user_id=user_id,
                            bill_id=bill_id,
                            bill_type=bill_type,
                            bill_number=bill_number,
                            congress=congress,
                            title=title
                        )
                        save_db.add(new_track)
                
                save_db.commit()

        except Exception as e:
            yield f"\n\nError: {str(e)}"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"X-Conversation-Id": conv_id})

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/member/{bioguide_id}")
async def get_member_dashboard(bioguide_id: str):
    from .services.cosint.api_client import CongressAPIClient
    client = CongressAPIClient()
    try:
        details = client.get_member_details(bioguide_id)
        bills = client.get_sponsored_legislation(bioguide_id, limit=10)
        
        # Get recent votes
        recent_votes_raw = client.get_recent_house_votes(limit=5)
        votes = []
        for v in recent_votes_raw:
            # Fetch bill title for more context
            bill_details = {}
            if v.get("legislationNumber") and v.get("legislationType"):
                try:
                    bill_details = client.get_bill_details(
                        v.get("congress"), 
                        v.get("legislationType"), 
                        v.get("legislationNumber")
                    )
                except:
                    pass

            vote_cast = client.get_member_vote_on_roll_call(
                v.get("congress"), 
                v.get("sessionNumber"), 
                v.get("rollCallNumber"), 
                bioguide_id
            )
            votes.append({
                "legislation": v.get("legislationNumber", "N/A"),
                "legislationUrl": v.get("legislationUrl"),
                "legislationTitle": bill_details.get("title", "No title available"),
                "question": v.get("voteQuestion"),
                "vote": vote_cast or "Not Voting",
                "result": v.get("result"),
                "date": v.get("startDate")
            })

        return {
            "details": details,
            "bills": bills,
            "votes": votes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tracked-bills")
async def list_tracked_bills(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    bills = db.query(TrackedBill).filter(TrackedBill.user_id == user_id).order_by(TrackedBill.created_at.desc()).all()
    return bills

@app.delete("/tracked-bills/{bill_id}")
async def untrack_bill(bill_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    bill = db.query(TrackedBill).filter(TrackedBill.bill_id == bill_id, TrackedBill.user_id == user_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Tracked bill not found")
    db.delete(bill)
    db.commit()
    return {"status": "success"}

# Research Notes Endpoints
@app.get("/member/{bioguide_id}/notes")
async def list_member_notes(bioguide_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    notes = db.query(ResearchNote).filter(
        ResearchNote.user_id == user_id,
        ResearchNote.bioguide_id == bioguide_id
    ).order_by(ResearchNote.created_at.desc()).all()
    return notes

@app.post("/member/{bioguide_id}/notes")
async def create_member_note(bioguide_id: str, note: NoteCreate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    new_note = ResearchNote(
        user_id=user_id,
        bioguide_id=bioguide_id,
        title=note.title,
        content=note.content
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note

@app.patch("/notes/{note_id}")
async def update_note(note_id: str, update: NoteUpdate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(ResearchNote).filter(ResearchNote.id == note_id, ResearchNote.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if update.title is not None:
        note.title = update.title
    if update.content is not None:
        note.content = update.content
    
    db.commit()
    db.refresh(note)
    return note

@app.delete("/notes/{note_id}")
async def delete_note(note_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(ResearchNote).filter(ResearchNote.id == note_id, ResearchNote.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
