import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr, Field

from app.data_store import DataStore

app = FastAPI(
    title="Ace Divino Vendor Scorecard & Resident AI Assistant",
    description="AOA Vendor Evaluation, Rating & AI Query Portal for Ace Divino, Greater Noida West",
    version="1.0.0"
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize DataStore
store = DataStore()

# Pydantic Schema Definitions
class RatingCategory(BaseModel):
    quality: int = Field(..., ge=1, le=5)
    punctuality: int = Field(..., ge=1, le=5)
    staff_behavior: int = Field(..., ge=1, le=5)
    responsiveness: int = Field(..., ge=1, le=5)
    equipment: int = Field(..., ge=1, le=5)

class RatingSubmission(BaseModel):
    vendor_id: str
    resident_name: str = Field(..., min_length=2)
    resident_email: str = Field(..., min_length=5)
    flat_no: str = Field(..., min_length=2)
    ratings: RatingCategory
    comment: str = Field(..., min_length=10, description="Compulsory comment detailing vendor performance")

class AIChatQuery(BaseModel):
    query: str = Field(..., min_length=2)

class SLAIncidentSubmission(BaseModel):
    vendor_id: str
    title: str = Field(..., min_length=5)
    reported_by: str
    flat: str
    severity: str = "Medium"
    description: str = Field(..., min_length=10)

def compute_vendor_score(vendor_id: str) -> Dict[str, Any]:
    data = store.data
    reviews = [r for r in data["reviews"] if r["vendor_id"] == vendor_id]
    
    if not reviews:
        return {
            "score": 0.0,
            "total_reviews": 0,
            "status": "UNRATED",
            "status_label": "No Ratings Yet",
            "status_badge_class": "badge-neutral",
            "breakdown": {"quality": 0, "punctuality": 0, "staff_behavior": 0, "responsiveness": 0, "equipment": 0}
        }
    
    total_score = sum(r["overall_rating"] for r in reviews)
    avg_score = round(total_score / len(reviews), 2)
    
    q_avg = round(sum(r["ratings"]["quality"] for r in reviews) / len(reviews), 1)
    p_avg = round(sum(r["ratings"]["punctuality"] for r in reviews) / len(reviews), 1)
    b_avg = round(sum(r["ratings"]["staff_behavior"] for r in reviews) / len(reviews), 1)
    r_avg = round(sum(r["ratings"]["responsiveness"] for r in reviews) / len(reviews), 1)
    e_avg = round(sum(r["ratings"]["equipment"] for r in reviews) / len(reviews), 1)
    
    # Decision Matrix Thresholds
    if avg_score >= 4.0:
        status_key = "KEEP"
        label = "Grade A - Retain Contract"
        badge = "badge-success"
    elif avg_score >= 3.2:
        status_key = "UNDER_REVIEW"
        label = "Grade B - Satisfactory / Audit"
        badge = "badge-info"
    elif avg_score >= 2.5:
        status_key = "NOTICE"
        label = "Grade C - Serve SLA Warning Notice"
        badge = "badge-warning"
    else:
        status_key = "TERMINATE"
        label = "Grade D - Initiate Vendor Replacement"
        badge = "badge-danger"
        
    return {
        "score": avg_score,
        "total_reviews": len(reviews),
        "status": status_key,
        "status_label": label,
        "status_badge_class": badge,
        "breakdown": {
            "quality": q_avg,
            "punctuality": p_avg,
            "staff_behavior": b_avg,
            "responsiveness": r_avg,
            "equipment": e_avg
        }
    }

@app.get("/")
def render_index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"society": store.data["society"]})


@app.get("/api/vendors")
def get_vendors():
    vendors = store.data["vendors"]
    results = []
    
    for v in vendors:
        v_copy = dict(v)
        v_copy["metrics"] = compute_vendor_score(v["id"])
        results.append(v_copy)
        
    return {"vendors": results, "total_vendors": len(results)}

@app.get("/api/vendors/{vendor_id}/reviews")
def get_vendor_reviews(vendor_id: str):
    vendor = next((v for v in store.data["vendors"] if v["id"] == vendor_id), None)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    reviews = [r for r in store.data["reviews"] if r["vendor_id"] == vendor_id]
    reviews_sorted = sorted(reviews, key=lambda x: x["created_at"], reverse=True)
    
    return {
        "vendor": vendor,
        "metrics": compute_vendor_score(vendor_id),
        "reviews": reviews_sorted
    }

@app.post("/api/vendors/rate")
def submit_rating(payload: RatingSubmission):
    # Compulsory comment check
    comment_text = payload.comment.strip()
    if len(comment_text) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Compulsory requirement failed: A detailed feedback comment of at least 10 characters is mandatory when submitting a rating."
        )
        
    vendor = next((v for v in store.data["vendors"] if v["id"] == payload.vendor_id), None)
    if not vendor:
        raise HTTPException(status_code=404, detail="Selected vendor does not exist.")
        
    # Calculate overall rating
    r = payload.ratings
    overall = round((r.quality + r.punctuality + r.staff_behavior + r.responsiveness + r.equipment) / 5.0, 2)
    
    new_review = {
        "id": f"rev-{uuid.uuid4().hex[:6]}",
        "vendor_id": payload.vendor_id,
        "resident_name": payload.resident_name.strip(),
        "resident_email": payload.resident_email.strip().lower(),
        "flat_no": payload.flat_no.strip(),
        "ratings": {
            "quality": r.quality,
            "punctuality": r.punctuality,
            "staff_behavior": r.staff_behavior,
            "responsiveness": r.responsiveness,
            "equipment": r.equipment
        },
        "overall_rating": overall,
        "comment": comment_text,
        "created_at": datetime.now().isoformat()
    }
    
    store.data["reviews"].append(new_review)
    store.save_data()
    
    updated_metrics = compute_vendor_score(payload.vendor_id)
    
    return {
        "message": f"Rating successfully submitted for {vendor['name']}!",
        "review": new_review,
        "updated_metrics": updated_metrics
    }

@app.get("/api/aoa/analytics")
def get_aoa_analytics():
    vendors = store.data["vendors"]
    reviews = store.data["reviews"]
    incidents = store.data.get("sla_incidents", [])
    
    vendor_metrics = []
    status_counts = {"KEEP": 0, "UNDER_REVIEW": 0, "NOTICE": 0, "TERMINATE": 0, "UNRATED": 0}
    
    for v in vendors:
        m = compute_vendor_score(v["id"])
        vendor_metrics.append({
            "vendor_id": v["id"],
            "vendor_name": v["name"],
            "category": v["category"],
            "parent_vendor": v["parent_vendor"],
            "contract_end": v["contract_end"],
            "score": m["score"],
            "total_reviews": m["total_reviews"],
            "status": m["status"],
            "status_label": m["status_label"],
            "status_badge_class": m["status_badge_class"]
        })
        status_counts[m["status"]] += 1
        
    rated_vendors = [vm for vm in vendor_metrics if vm["total_reviews"] > 0]
    rated_vendors.sort(key=lambda x: x["score"], reverse=True)
    
    top_vendor = rated_vendors[0] if rated_vendors else None
    lowest_vendor = rated_vendors[-1] if rated_vendors else None
    
    avg_society_vendor_score = round(sum(vm["score"] for vm in rated_vendors) / len(rated_vendors), 2) if rated_vendors else 0.0
    
    return {
        "society": store.data["society"],
        "summary": {
            "total_vendors": len(vendors),
            "total_resident_reviews": len(reviews),
            "avg_society_score": avg_society_vendor_score,
            "status_counts": status_counts,
            "total_sla_incidents": len(incidents)
        },
        "top_performing_vendor": top_vendor,
        "lowest_performing_vendor": lowest_vendor,
        "all_vendor_metrics": vendor_metrics,
        "recent_reviews": sorted(reviews, key=lambda x: x["created_at"], reverse=True)[:5],
        "recent_sla_incidents": incidents
    }

@app.post("/api/ai/chat")
def resident_ai_chatbot(payload: AIChatQuery):
    q = payload.query.lower().strip()
    knowledge = store.data.get("ai_knowledge", [])
    
    matched_entry = None
    max_matches = 0
    
    for entry in knowledge:
        matches = sum(1 for kw in entry["keywords"] if kw in q)
        if matches > max_matches:
            max_matches = matches
            matched_entry = entry
            
    if matched_entry and max_matches > 0:
        return {
            "matched": True,
            "question": matched_entry["question"],
            "answer": matched_entry["answer"],
            "suggested_actions": ["View CBRE Contact", "Check Pool Rules", "View Vendor Scorecards"]
        }
        
    # Vendor specific queries
    for v in store.data["vendors"]:
        if v["name"].lower() in q or v["id"].lower() in q or v["category"].lower() in q:
            m = compute_vendor_score(v["id"])
            return {
                "matched": True,
                "question": f"Query regarding {v['name']}",
                "answer": f"🏢 **{v['name']} ({v['category']})**\n"
                          f"- **Contract Type**: {v['contract_type']}\n"
                          f"- **Contact Manager**: {v['contact_person']} ({v['phone']})\n"
                          f"- **Current AOA Score**: ⭐ **{m['score']} / 5.0** ({m['total_reviews']} resident reviews)\n"
                          f"- **AOA Status**: {m['status_label']}\n"
                          f"- **Description**: {v['description']}",
                "suggested_actions": [f"Rate {v['name']}", "View All Reviews"]
            }
            
    # Generic intelligent assistant response
    return {
        "matched": False,
        "question": payload.query,
        "answer": f"Hello Resident! I am your **Ace Divino AI Assistant** 🤖.\n\n"
                  f"I searched Ace Divino society handbook and AOA vendor records for: *\"{payload.query}\"*.\n\n"
                  f"Here are quick contacts you might find helpful:\n"
                  f"- **AOA Helpdesk Office**: Room 102 Clubhouse (`aoa@acedivino.in`)\n"
                  f"- **CBRE Facility Manager**: Mr. Vikram Rathore (+91 98112 34567)\n"
                  f"- **CityForce Security Desk**: Main Gate Ext 101 (+91 98112 34569)\n\n"
                  f"You can ask me about pool timings, shifting NOC, waste segregation, lift breakdowns, or vendor ratings!",
        "suggested_actions": ["Pool Timings", "CityForce Security", "CBRE Office Location", "Shifting Rules"]
    }

@app.post("/api/sla/incidents")
def report_sla_incident(payload: SLAIncidentSubmission):
    vendor = next((v for v in store.data["vendors"] if v["id"] == payload.vendor_id), None)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    incident = {
        "id": f"sla-{uuid.uuid4().hex[:6]}",
        "vendor_id": payload.vendor_id,
        "vendor_name": vendor["name"],
        "title": payload.title.strip(),
        "reported_by": payload.reported_by.strip(),
        "flat": payload.flat.strip(),
        "severity": payload.severity,
        "status": "Logged / Under Review",
        "description": payload.description.strip(),
        "created_at": datetime.now().isoformat()
    }
    
    if "sla_incidents" not in store.data:
        store.data["sla_incidents"] = []
        
    store.data["sla_incidents"].append(incident)
    store.save_data()
    
    return {
        "message": f"SLA Incident logged for {vendor['name']}. AOA Board has been notified.",
        "incident": incident
    }

@app.get("/api/sla/incidents")
def list_sla_incidents():
    return {"incidents": store.data.get("sla_incidents", [])}
