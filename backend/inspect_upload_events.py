import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

print("--- ALL KNOWLEDGE AGENT EVENTS ---")
res = supabase.table("agent_events").select("*").eq("agent_name", "knowledge").order("created_at", desc=True).execute()
for r in res.data:
    print(r.get("created_at"), r.get("event_type"), repr(r.get("message")), repr(r.get("details")))

print("\n--- ALL SUPERVISOR EVENTS FOR UPLOAD ---")
res2 = supabase.table("agent_events").select("*").eq("agent_name", "supervisor").order("created_at", desc=True).limit(20).execute()
for r in res2.data:
    msg = r.get("message") or ""
    if "upload" in msg.lower() or "routed" in msg.lower():
        print(r.get("created_at"), r.get("event_type"), repr(msg), repr(r.get("details")))
