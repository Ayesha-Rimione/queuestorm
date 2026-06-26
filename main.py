from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from analyzer import analyze_ticket
import traceback

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze-ticket")
async def analyze(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON input"})

    if not body.get("ticket_id") or not body.get("complaint"):
        return JSONResponse(status_code=400, content={"error": "Missing required fields: ticket_id and complaint"})

    if not body.get("complaint", "").strip():
        return JSONResponse(status_code=422, content={"error": "Complaint cannot be empty"})

    try:
        result = analyze_ticket(body)
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Internal server error"})