from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_db, Conversation, TrackedBill, ResearchNote
from .auth import get_current_user
from datetime import datetime

router = APIRouter(tags=["notebook"])

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class NoteCreate(BaseModel):
    title: str
    content: str

class ConversationUpdate(BaseModel):
    title: str

class BillTrackRequest(BaseModel):
    bill_id: str
    bill_type: str
    bill_number: str
    congress: int
    title: str

class RegistryOrderItem(BaseModel):
    id: str
    type: str # 'conversation' or 'bill'
    position: int

class RegistryOrderUpdate(BaseModel):
    items: List[RegistryOrderItem]

# --- Conversation Endpoints ---

@router.post("/conversations")
async def create_conversation(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = Conversation(title="New Chat", user_id=user_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": str(conv.id), "title": conv.title}

@router.get("/conversations/member/{bioguide_id}")
async def get_member_conversation(bioguide_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.bioguide_id == bioguide_id
    ).first()
    
    if conv:
        return {"id": str(conv.id)}
    return {"id": None}

@router.post("/conversations/member/{bioguide_id}")
async def create_member_conversation(bioguide_id: str, name: Optional[str] = None, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.bioguide_id == bioguide_id
    ).first()
    
    if conv:
        return {"id": str(conv.id)}
    
    new_conv = Conversation(
        title=name or f"Briefing: {bioguide_id}",
        user_id=user_id,
        bioguide_id=bioguide_id
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return {"id": str(new_conv.id)}

@router.get("/conversations")
async def list_conversations(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conversations = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.bioguide_id.isnot(None)
    ).order_by(Conversation.created_at.desc()).all()
    return [{"id": str(c.id), "title": c.title, "created_at": c.created_at, "bioguide_id": c.bioguide_id, "position": c.position} for c in conversations]

@router.patch("/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, update: ConversationUpdate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv.title = update.title
    db.commit()
    db.refresh(conv)
    return conv

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"status": "success"}

# --- Bill Tracking Endpoints ---

@router.get("/tracked-bills")
async def list_tracked_bills(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    bills = db.query(TrackedBill).filter(TrackedBill.user_id == user_id).order_by(TrackedBill.created_at.desc()).all()
    return bills

@router.post("/tracked-bills")
async def track_bill(request: BillTrackRequest, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(TrackedBill).filter(
        TrackedBill.user_id == user_id,
        TrackedBill.bill_id == request.bill_id
    ).first()
    
    if existing:
        return existing
        
    new_track = TrackedBill(
        user_id=user_id,
        bill_id=request.bill_id,
        bill_type=request.bill_type,
        bill_number=request.bill_number,
        congress=request.congress,
        title=request.title
    )
    db.add(new_track)
    db.commit()
    db.refresh(new_track)
    return new_track

@router.patch("/tracked-bills/{bill_id}")
async def update_tracked_bill(bill_id: str, update: NoteUpdate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    bill = db.query(TrackedBill).filter(TrackedBill.bill_id == bill_id, TrackedBill.user_id == user_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Tracked bill not found")
    
    if update.title is not None:
        bill.title = update.title
    
    db.commit()
    db.refresh(bill)
    return bill

@router.delete("/tracked-bills/{bill_id}")
async def untrack_bill(bill_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    bill = db.query(TrackedBill).filter(TrackedBill.bill_id == bill_id, TrackedBill.user_id == user_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Tracked bill not found")
    db.delete(bill)
    db.commit()
    return {"status": "success"}

# --- Ordering Endpoint ---

@router.put("/order")
async def update_registry_order(request: RegistryOrderUpdate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    for item in request.items:
        if item.type == 'conversation':
            db.query(Conversation).filter(Conversation.id == item.id, Conversation.user_id == user_id).update({"position": item.position})
        else:
            db.query(TrackedBill).filter(TrackedBill.bill_id == item.id, TrackedBill.user_id == user_id).update({"position": item.position})
    db.commit()
    return {"status": "success"}

# --- Research Notes Endpoints ---

@router.get("/member/{bioguide_id}/notes")
async def list_member_notes(bioguide_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    notes = db.query(ResearchNote).filter(
        ResearchNote.user_id == user_id,
        ResearchNote.bioguide_id == bioguide_id
    ).order_by(ResearchNote.created_at.desc()).all()
    return notes

@router.post("/member/{bioguide_id}/notes")
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

@router.patch("/notes/{note_id}")
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

@router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(ResearchNote).filter(ResearchNote.id == note_id, ResearchNote.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"status": "success"}
