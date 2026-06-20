import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('cloud_api/.env')
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)

u_count = supabase.table('universe').select('*', count='exact').execute()
n_count = supabase.table('news_sentiment').select('*', count='exact').execute()

print(f"Universe count: {u_count.count}")
print(f"News sentiment count: {n_count.count}")
