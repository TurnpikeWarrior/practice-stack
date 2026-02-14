from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db, Conversation, Message, SessionLocal, TrackedBill
from ..services.cosint.agent import get_cosint_agent
from .auth import get_current_user
import re

router = APIRouter(tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    initial_context: Optional[str] = None
    bioguide_id: Optional[str] = None

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.user_id and str(conv.user_id) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    return [{"role": m.role, "content": m.content} for m in messages]

@router.post("/chat/stream")
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
        
        if conv and conv.user_id and str(conv.user_id) != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        if conv and conv.title == "New Chat":
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
                    yield f"

*Accessing information from {source}...*

"

            # 4. Intel Extraction Step
            try:
                from ..services.cosint.agent import get_intel_extraction_agent
                extraction_agent = get_intel_extraction_agent()
                intel = await extraction_agent.ainvoke({"response": full_response})
                
                if intel.is_useful:
                    packet_tag = f"

[INTEL_PACKET: {intel.title} | {intel.content} |END_PACKET]"
                    yield packet_tag
                    full_response += packet_tag
            except Exception as e:
                print(f"Intel extraction failed: {e}")

            # 5. Save assistant message to DB after stream finishes
            with SessionLocal() as save_db:
                assistant_msg = Message(conversation_id=conv_id, role="assistant", content=full_response)
                save_db.add(assistant_msg)
                
                # CHECK FOR BILL TRACKING
                track_match = re.search(r"\[TRACK_BILL:\s*(\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^\]]+)\]", full_response)
                if track_match:
                    congress = int(track_match.group(1))
                    bill_type = track_match.group(2).strip()
                    bill_number = track_match.group(3).strip()
                    title = track_match.group(4).strip()
                    bill_id = f"{congress}-{bill_type}-{bill_number}".lower()
                    
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

                # 6. PRUNING LOGIC
                try:
                    limit = 10
                    all_msgs = save_db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at.desc()).all()
                    if len(all_msgs) > limit:
                        msgs_to_delete = all_msgs[limit:]
                        for m in msgs_to_delete:
                            save_db.delete(m)
                        save_db.commit()
                except Exception as prune_err:
                    print(f"Chat pruning failed: {prune_err}")

        except Exception as e:
            yield f"

Error: {str(e)}"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"X-Conversation-Id": conv_id})
