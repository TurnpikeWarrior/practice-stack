import os
import requests
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

class CongressAPIClient:
    BASE_URL = "https://api.congress.gov/v3"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("CONGRESS_API_KEY")
        if not self.api_key:
            raise ValueError("CONGRESS_API_KEY not found. Please set it in your environment or .env file.")

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"
        default_params = {"api_key": self.api_key, "format": "json"}
        if params:
            default_params.update(params)
        
        response = requests.get(url, params=default_params)
        response.raise_for_status()
        return response.json()

    def get_members(self, current_member: bool = True, limit: int = 20, state: Optional[str] = None, district: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch a list of members. Uses path-based filtering for state and district if provided.
        """
        endpoint = "member"
        if state and district is not None:
            endpoint = f"member/{state}/{district}"
        elif state:
            endpoint = f"member/{state}"
        
        params = {"limit": limit}
        if current_member:
            params["currentMember"] = "true"
        
        data = self._get(endpoint, params=params)
        return data.get("members", [])

    def get_member_details(self, bioguide_id: str) -> Dict[str, Any]:
        """
        Fetch details for a specific member by their Bioguide ID.
        """
        data = self._get(f"member/{bioguide_id}")
        return data.get("member", {})

    def get_member_committees(self, bioguide_id: str) -> List[Dict[str, Any]]:
        """
        Fetch committee assignments for a specific member.
        """
        data = self._get(f"member/{bioguide_id}/committees")
        return data.get("committees", [])

    def get_sponsored_legislation(self, bioguide_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Fetch legislation sponsored by a specific member.
        """
        params = {"limit": limit}
        data = self._get(f"member/{bioguide_id}/sponsored-legislation", params=params)
        return data.get("sponsoredLegislation", [])

    def get_bill_details(self, congress: int, bill_type: str, bill_number: str) -> Dict[str, Any]:
        """
        Fetch details for a specific bill.
        """
        data = self._get(f"bill/{congress}/{bill_type.lower()}/{bill_number}")
        return data.get("bill", {})

    def get_bill_text(self, congress: int, bill_type: str, bill_number: str) -> List[Dict[str, Any]]:
        """
        Fetch text versions for a specific bill.
        """
        data = self._get(f"bill/{congress}/{bill_type.lower()}/{bill_number}/text")
        return data.get("textVersions", [])

    def get_bill_actions(self, congress: int, bill_type: str, bill_number: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch actions taken on a specific bill.
        """
        params = {"limit": limit}
        data = self._get(f"bill/{congress}/{bill_type.lower()}/{bill_number}/actions", params=params)
        return data.get("actions", [])

    def get_bill_cosponsors(self, congress: int, bill_type: str, bill_number: str) -> List[Dict[str, Any]]:
        """
        Fetch cosponsors for a specific bill.
        """
        data = self._get(f"bill/{congress}/{bill_type.lower()}/{bill_number}/cosponsors")
        return data.get("cosponsors", [])

    def get_recent_house_votes(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetch the most recent House roll call votes.
        """
        params = {"limit": limit}
        data = self._get("house-vote", params=params)
        return data.get("houseRollCallVotes", [])

    def get_member_vote_on_roll_call(self, congress: int, session: int, roll_call: int, bioguide_id: str) -> Optional[str]:
        """
        Find how a specific member voted on a specific House roll call.
        """
        endpoint = f"house-vote/{congress}/{session}/{roll_call}/members"
        data = self._get(endpoint)
        
        member_votes = data.get("houseRollCallVoteMemberVotes", {}).get("results", [])
        for mv in member_votes:
            if mv.get("bioguideID") == bioguide_id:
                return mv.get("voteCast")
        return None

    def search_member_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """
        A helper to find a member by name. 
        Splits the search query into parts and ensures all parts are present in the member name.
        """
        members = self.get_members(limit=250)
        search_parts = name.lower().split()
        
        for m in members:
            member_name_lower = m.get("name", "").lower()
            if all(part in member_name_lower for part in search_parts):
                return m
        return None
