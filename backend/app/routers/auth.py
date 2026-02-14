import os
import requests
from fastapi import Header, HTTPException
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

# JWT Verification Logic using JWKS (Supports ES256)
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
