from fastapi import APIRouter, HTTPException
from ..services.cosint.api_client import CongressAPIClient
from ..services.cosint.agent import get_bill_analysis_agent
import re

router = APIRouter(tags=["intelligence"])

@router.get("/member/{bioguide_id}")
async def get_member_dashboard(bioguide_id: str):
    client = CongressAPIClient()
    try:
        details = client.get_member_details(bioguide_id)
        bills = client.get_sponsored_legislation(bioguide_id, limit=10)
        
        # Get recent votes - fetch more to allow for filtering
        recent_votes_raw = client.get_recent_house_votes(limit=15)
        votes = []
        for v in recent_votes_raw:
            # Skip amendments (H.Amdt / S.Amdt)
            leg_type = v.get("legislationType", "").upper()
            if "AMDT" in leg_type:
                continue
                
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
                "congress": v.get("congress"),
                "type": v.get("legislationType"),
                "number": v.get("legislationNumber"),
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

@router.get("/bill/{congress}/{bill_type}/{bill_number}")
async def get_bill_dashboard(congress: int, bill_type: str, bill_number: str):
    client = CongressAPIClient()
    try:
        # Sanitize bill_type (e.g., 'h.r.' -> 'hr')
        sanitized_type = re.sub(r'[^a-zA-Z]', '', bill_type).lower()
        
        details = client.get_bill_details(congress, sanitized_type, bill_number)
        actions = client.get_bill_actions(congress, sanitized_type, bill_number)
        cosponsors = client.get_bill_cosponsors(congress, sanitized_type, bill_number)
        text_versions = client.get_bill_text(congress, sanitized_type, bill_number)
        
        # 1. Fetch raw text content
        raw_text = client.get_bill_text_content(congress, sanitized_type, bill_number)
        
        # 2. Run Analysis Agent
        ai_summary = None
        if raw_text:
            try:
                analysis_agent = get_bill_analysis_agent()
                result = await analysis_agent.ainvoke({"bill_text": raw_text})
                ai_summary = result.content
            except Exception as e:
                print(f"AI Bill Analysis failed: {e}")

        return {
            "details": details,
            "actions": actions,
            "cosponsors": cosponsors,
            "text": text_versions,
            "ai_summary": ai_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
