import sys
import uvicorn

if __name__ == "__main__":
    print("===============================================================")
    print("   ACE DIVINO - AOA VENDOR SCORECARD & RESIDENT AI PORTAL")
    print("===============================================================")
    print(" Starting Uvicorn Web Server on http://127.0.0.1:8000 ...")
    print(" Press Ctrl+C to stop.")
    print("===============================================================")
    
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
