import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

print("--- ERROR EVENTS ---")
res = supabase.table("agent_events").select("*").eq("event_type", "error").order("created_at", desc=True).limit(10).execute()
for r in res.data:
    print(r.get("created_at"), repr(r.get("message")), repr(r.get("details")))
