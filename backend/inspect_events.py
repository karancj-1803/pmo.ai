import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

print("--- RECENT DOCUMENTS ---")
res_docs = supabase.table("documents").select("*").order("created_at", desc=True).limit(5).execute()
for r in res_docs.data:
    print(f"ID: {r['id']}, Project: {r['project_id']}, Filename: {r['filename']}, Content-Type: {r['content_type']}, Path: {r['storage_path']}, Content Len: {len(r.get('content_text') or '')}, Summary: {r['summary']}")

print("\n--- RECENT CHAT MESSAGES ---")
res_chat = supabase.table("chat_messages").select("*").order("created_at", desc=True).limit(5).execute()
for r in res_chat.data:
    print(r)

print("\n--- RECENT AGENT EVENTS ---")
res_events = supabase.table("agent_events").select("*").order("created_at", desc=True).limit(10).execute()
for r in res_events.data:
    print(f"Event: {r['event_type']}, Agent: {r['agent_name']}, Msg: {r['message']}, Details: {r['details']}")
