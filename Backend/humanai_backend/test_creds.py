import os
import traceback
import firebase_admin
from firebase_admin import credentials, auth

def main():
    print("Testing Firebase Service Account...")
    cred_path = "./service-account.json"
    if not os.path.exists(cred_path):
        print(f"File not found: {cred_path}")
        return

    try:
        cred = credentials.Certificate(cred_path)
        # Check if already initialized to avoid duplicate initialization error
        try:
            app = firebase_admin.initialize_app(cred)
        except ValueError:
            app = firebase_admin.get_app()

        print("Firebase Admin SDK initialized successfully.")
        
        # Try a simple Firebase Auth operation (like listing users or creating a dummy one)
        print("Testing auth operation (list users)...")
        page = auth.list_users(max_results=1)
        print("Success! Connection established and authenticated.")
        print(f"Found {len(list(page.users))} users in the page.")
    except Exception as e:
        print("\n--- ERROR DETECTED ---")
        print(f"Exception Type: {type(e)}")
        print(f"Exception Message: {e}")
        print("\nTraceback:")
        traceback.print_exc()

if __name__ == "__main__":
    main()
