import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table("documents").select("*").eq("id", "51a21e35-671e-474d-a868-b158398adfe8").execute()
for r in res.data:
    print("ID:", r.get("id"))
    print("Filename:", r.get("filename"))
    print("Path:", r.get("storage_path"))
    print("Summary:", repr(r.get("summary")))
