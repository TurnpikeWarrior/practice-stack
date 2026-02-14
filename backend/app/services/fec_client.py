import os
import requests
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

class FECClient:
    BASE_URL = "https://api.open.fec.gov/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("CONGRESS_API_KEY") # Usually the same api.data.gov key
        if not self.api_key:
            raise ValueError("FEC API Key (CONGRESS_API_KEY) not found.")

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"
        default_params = {"api_key": self.api_key}
        if params:
            default_params.update(params)
        
        response = requests.get(url, params=default_params)
        response.raise_for_status()
        return response.json()

    def get_candidate_by_bioguide(self, bioguide_id: str, name: Optional[str] = None, state: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Find candidate record by name and state, or Bioguide ID if name is not provided.
        The FEC API bioguide_id filter can sometimes be unreliable.
        """
        params = {}
        if name:
            params["q"] = name
        if state:
            params["state"] = state
        
        # If we have name/state, use the general candidates search which is more robust
        endpoint = "candidates/" if (name or state) else "candidates/search/"
        if not (name or state):
            params["bioguide_id"] = bioguide_id
            
        data = self._get(endpoint, params)
        results = data.get("results", [])
        
        if not results:
            return None
            
        # If we searched by name, try to find the one that matches Bioguide or is the most recent/relevant
        if name:
            # 1. Look for exact Bioguide match in results if available
            for cand in results:
                if cand.get("bioguide_id") == bioguide_id:
                    return cand
            
            # 2. Look for an active candidate that matches name
            active_cands = [c for c in results if c.get("active_through", 0) >= 2024]
            if active_cands:
                return active_cands[0]
                
        return results[0]

    def get_candidate_totals(self, candidate_id: str, cycle: int = 2024) -> Dict[str, Any]:
        """
        Get financial totals for a candidate.
        """
        data = self._get(f"candidate/{candidate_id}/totals/", {"cycle": cycle})
        results = data.get("results", [])
        return results[0] if results else {}

    def get_top_contributors(self, candidate_id: str, cycle: int = 2024) -> List[Dict[str, Any]]:
        """
        The FEC API doesn't have a direct 'top contributors by org' endpoint like OpenSecrets.
        We can get the top committees contributing to this candidate.
        """
        # This endpoint shows committees that contributed to the candidate
        data = self._get(f"candidate/{candidate_id}/committees/", {"cycle": cycle})
        return data.get("results", [])

    def get_communication_costs(self, candidate_id: str) -> List[Dict[str, Any]]:
        """
        Get communication costs related to this candidate.
        """
        data = self._get("communication_costs/", {"candidate_id": candidate_id, "sort": "-total_amount"})
        return data.get("results", [])
