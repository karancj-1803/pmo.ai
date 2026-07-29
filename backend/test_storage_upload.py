import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

project_id = "35d8ca03-e53f-40e4-89b4-a2ab72459010"
filename = "requirements.txt.txt"
content_text = "Test requirements content."

storage_path = f"{project_id}/{filename}"
print("Uploading to storage...")
try:
    file_bytes = content_text.encode("utf-8")
    res = supabase.storage.from_("documents").upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "text/plain", "upsert": "true"}
    )
    print("Storage upload response:", res)
except Exception as e:
    print("Storage upload failed:", e)

document_id = "51a21e35-671e-474d-a868-b158398adfe8"
print("\nUpdating document record...")
try:
    res_db = supabase.table("documents").update({
        "storage_path": storage_path,
        "summary": "Updated test summary"
    }).eq("id", document_id).execute()
    print("DB update response:", res_db.data)
except Exception as e:
    print("DB update failed:", e)
