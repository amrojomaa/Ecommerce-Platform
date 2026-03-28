from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from fastapi import WebSocket, WebSocketDisconnect, HTTPException, status, Depends, UploadFile, File
from fastapi import APIRouter
from sqlalchemy.orm import Session, selectinload, joinedload
from ..database import get_db
from app import models, schemas, OAuth2
from app.utils.geocoding import geocode_address_with_fallback
from app.routers.admin import require_driver, require_admin, require_employee
from app.OAuth2 import verify_access_token
import os
import uuid
import json

router = APIRouter(
    prefix="/delivery",
    tags=['Delivery']
)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _job_to_response(job: models.DBDeliveryJob) -> dict:
    """Convert a DBDeliveryJob to a response dict with customer and item info."""
    if not job:
        return {}
        
    order = job.order
    customer = order.user if order else None
    items = []
    if order and order.orderitems:
        for oi in order.orderitems:
            images = []
            if oi.product and hasattr(oi.product, 'images') and oi.product.images:
                images = [img.image_path for img in oi.product.images]
            items.append({
                "id": oi.id,
                "product": {
                    "name": oi.product.name if oi.product else "Product",
                    "images": images,
                },
                "quantity": oi.quantity,
                "price": float(oi.price),
                "total": float(oi.total),
            })

    effective_payment_amount = float(order.total_amount) if order and order.total_amount is not None else float(job.payment_amount or 0)

    return {
        "id": job.id,
        "order_id": job.order_id,
        "driver_id": job.driver_id,
        "status": job.status,
        "pickup_address": job.pickup_address,
        "pickup_latitude": job.pickup_latitude,
        "pickup_longitude": job.pickup_longitude,
        "delivery_address": job.delivery_address,
        "delivery_latitude": job.delivery_latitude,
        "delivery_longitude": job.delivery_longitude,
        "payment_amount": effective_payment_amount,
        "issue_description": job.issue_description,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "customer": {
            "id": customer.id,
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "phone": customer.phone,
            "city": customer.city,
            "street": customer.street,
        } if customer else None,
        "items": items,
    }


def _load_job_query(db: Session):
    return (
        db.query(models.DBDeliveryJob)
        .options(
            joinedload(models.DBDeliveryJob.order)
            .joinedload(models.DBOrder.user),
            joinedload(models.DBDeliveryJob.order)
            .selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
            .selectinload(models.DBProduct.images),
        )
    )


# ─── Available Jobs ──────────────────────────────────────────────────────────

@router.get("/available-jobs", response_model=List[schemas.DeliveryJobResponse])
def get_available_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    """List all delivery jobs with status 'available'."""
    jobs = (
        _load_job_query(db)
        .filter(models.DBDeliveryJob.status == "available")
        .order_by(models.DBDeliveryJob.created_at.desc())
        .all()
    )
    return [_job_to_response(j) for j in jobs]


# ─── Accept / Decline ─────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/accept", response_model=schemas.DeliveryJobResponse)
def accept_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    # Lock the row to avoid race conditions when multiple drivers try to accept at once.
    job = (
        db.query(models.DBDeliveryJob)
        .filter(models.DBDeliveryJob.id == job_id)
        .with_for_update()
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Idempotent success: if this same driver already accepted the job, return it.
    if job.status == "assigned" and job.driver_id == current_user.id:
        loaded = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
        return _job_to_response(loaded)
    if job.status != "available":
        raise HTTPException(status_code=400, detail=f"Job is no longer available (current status: {job.status})")

    job.status = "assigned"
    job.driver_id = current_user.id
    job.updated_at = datetime.now(timezone.utc)

    # Also update the order
    if job.order:
        job.order.driver_id = current_user.id
        job.order.status = "assigned"

    db.commit()
    loaded = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    return _job_to_response(loaded)


@router.post("/jobs/{job_id}/decline", response_model=schemas.DeliveryJobResponse)
def decline_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    job = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.driver_id and job.driver_id != current_user.id:
        raise HTTPException(status_code=400, detail="This job is assigned to another driver")

    # If driver previously accepted then declines, set back to available
    if job.status == "assigned" and job.driver_id == current_user.id:
        job.status = "available"
        job.driver_id = None
        job.updated_at = datetime.now(timezone.utc)
        if job.order:
            job.order.driver_id = None
            job.order.status = "paid"
        db.commit()
        db.refresh(job)

    return _job_to_response(job)


# ─── Pickup & Deliver ─────────────────────────────────────────────────────────

@router.patch("/jobs/{job_id}/pickup", response_model=schemas.DeliveryJobResponse)
def mark_pickup(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    job = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")
    if job.status != "assigned":
        raise HTTPException(status_code=400, detail=f"Cannot pick up from status '{job.status}'")

    job.status = "picked_up"
    job.updated_at = datetime.now(timezone.utc)
    if job.order:
        job.order.status = "picked_up"
    db.commit()
    # Reload with all relationships fresh for the response
    job = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    return _job_to_response(job)


@router.patch("/jobs/{job_id}/deliver", response_model=schemas.DeliveryJobResponse)
def mark_delivered(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    job = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")
    if job.status not in ("picked_up", "delivering"):
        raise HTTPException(status_code=400, detail=f"Cannot deliver from status '{job.status}'")

    job.status = "delivered"
    job.updated_at = datetime.now(timezone.utc)
    if job.order:
        job.order.status = "delivered"

    # Create earning record
    earning_amount = float(job.order.total_amount) if job.order and job.order.total_amount is not None else float(job.payment_amount or 0)
    earning = models.DBDriverEarning(
        driver_id=current_user.id,
        delivery_job_id=job.id,
        amount=earning_amount,
        status="pending",
    )
    db.add(earning)
    db.commit()
    # Reload with all relationships fresh for the response
    job = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    return _job_to_response(job)


# ─── Photo Upload ─────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/photo")
def upload_photo(
    job_id: int,
    photo_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    if photo_type not in ("pickup", "delivery"):
        raise HTTPException(status_code=400, detail="photo_type must be 'pickup' or 'delivery'")

    job = db.query(models.DBDeliveryJob).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    # Save file
    upload_dir = os.path.join("images", "delivery")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        content = file.file.read()
        f.write(content)

    photo = models.DBDeliveryPhoto(
        delivery_job_id=job_id,
        photo_type=photo_type,
        image_path=filepath,
    )
    db.add(photo)
    db.commit()

    return {"message": "Photo uploaded", "image_path": filepath}


# ─── Report Issue ─────────────────────────────────────────────────────────────

@router.post("/jobs/{job_id}/report-issue", response_model=schemas.DeliveryJobResponse)
def report_issue(
    job_id: int,
    report: schemas.IssueReport,
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    job = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your job")

    job.issue_type = report.issue_type
    job.issue_description = report.description
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


# ─── Driver Location ─────────────────────────────────────────────────────────

@router.patch("/location", response_model=schemas.DriverLocationResponse)
def update_location(
    loc: schemas.DriverLocationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    existing = db.query(models.DBDriverLocation).filter(
        models.DBDriverLocation.driver_id == current_user.id
    ).first()

    if existing:
        existing.latitude = loc.latitude
        existing.longitude = loc.longitude
        existing.updated_at = datetime.now(timezone.utc)
    else:
        existing = models.DBDriverLocation(
            driver_id=current_user.id,
            latitude=loc.latitude,
            longitude=loc.longitude,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing


@router.get("/location/{driver_id}", response_model=schemas.DriverLocationResponse)
def get_driver_location(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    loc = db.query(models.DBDriverLocation).filter(
        models.DBDriverLocation.driver_id == driver_id
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Driver location not found")
    return loc


# ─── Active Job & History ─────────────────────────────────────────────────────

@router.get("/jobs/active", response_model=List[schemas.DeliveryJobResponse])
def get_active_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    jobs = (
        _load_job_query(db)
        .filter(
            models.DBDeliveryJob.driver_id == current_user.id,
            models.DBDeliveryJob.status.in_(["assigned", "picked_up", "delivering"]),
        )
        .order_by(models.DBDeliveryJob.updated_at.desc())
        .all()
    )
    return [_job_to_response(j) for j in jobs]


@router.get("/jobs/history", response_model=List[schemas.DeliveryJobResponse])
def get_job_history(
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    jobs = (
        _load_job_query(db)
        .filter(
            models.DBDeliveryJob.driver_id == current_user.id,
            models.DBDeliveryJob.status.in_(["delivered", "cancelled"]),
        )
        .order_by(models.DBDeliveryJob.updated_at.desc())
        .all()
    )
    return [_job_to_response(j) for j in jobs]


# ─── Earnings ─────────────────────────────────────────────────────────────────

@router.get("/earnings", response_model=schemas.EarningsSummary)
def get_earnings(
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)

    all_earnings = (
        db.query(models.DBDriverEarning)
        .filter(models.DBDriverEarning.driver_id == current_user.id)
        .all()
    )

    total = sum(e.amount for e in all_earnings)
    today = sum(e.amount for e in all_earnings if e.created_at and e.created_at >= today_start)
    this_week = sum(e.amount for e in all_earnings if e.created_at and e.created_at >= week_start)
    this_month = sum(e.amount for e in all_earnings if e.created_at and e.created_at >= month_start)
    pending = sum(e.amount for e in all_earnings if e.status == "pending")
    total_deliveries = len([e for e in all_earnings])

    return {
        "today": today,
        "this_week": this_week,
        "this_month": this_month,
        "total": total,
        "total_deliveries": total_deliveries,
        "pending_payout": pending,
    }


@router.get("/earnings/history", response_model=List[schemas.EarningRecord])
def get_earnings_history(
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    earnings = (
        db.query(models.DBDriverEarning)
        .filter(models.DBDriverEarning.driver_id == current_user.id)
        .order_by(models.DBDriverEarning.created_at.desc())
        .all()
    )
    return earnings


@router.post("/earnings/payout")
def request_payout(
    payout: schemas.PayoutRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_driver),
):
    pending = (
        db.query(models.DBDriverEarning)
        .filter(
            models.DBDriverEarning.driver_id == current_user.id,
            models.DBDriverEarning.status == "pending",
        )
        .all()
    )

    if not pending:
        raise HTTPException(status_code=400, detail="No pending earnings to pay out")

    total_pending = sum(e.amount for e in pending)

    if payout.amount and payout.amount > total_pending:
        raise HTTPException(status_code=400, detail=f"Requested amount exceeds pending balance of ${total_pending:.2f}")

    # Mark as paid
    for e in pending:
        e.status = "paid"
    db.commit()

    return {"message": f"Payout of ${total_pending:.2f} requested successfully", "amount": total_pending}


# ─── Admin: List All Jobs ─────────────────────────────────────────────────────

@router.get("/all-jobs", response_model=List[schemas.AdminDeliveryJobResponse])
def get_all_delivery_jobs(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """List all delivery jobs (Admin only). Optionally filter by status."""
    query = _load_job_query(db)

    if status_filter and status_filter != "all":
        query = query.filter(models.DBDeliveryJob.status == status_filter)

    jobs = query.order_by(models.DBDeliveryJob.created_at.desc()).all()

    result = []
    for job in jobs:
        resp = _job_to_response(job)
        # Add driver name for admin view
        if job.driver:
            resp["driver_name"] = f"{job.driver.first_name} {job.driver.last_name}"
        else:
            resp["driver_name"] = None
        # Add issue_type
        resp["issue_type"] = job.issue_type
        result.append(resp)

    return result


@router.get("/jobs/{job_id}/details", response_model=schemas.AdminDeliveryJobResponse)
def get_delivery_job_details(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_employee),
):
    """Get delivery job details (Admin/Employee)."""
    job = _load_job_query(db).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resp = _job_to_response(job)
    if job.driver:
        resp["driver_name"] = f"{job.driver.first_name} {job.driver.last_name}"
    else:
        resp["driver_name"] = None
    resp["issue_type"] = job.issue_type
    return resp


# ─── Create Delivery Job (Admin & Internal) ──────────────────────────────

def internal_create_delivery_job(
    order_id: int,
    db: Session,
    pickup_address: Optional[str] = None,
    pickup_lat: Optional[float] = None,
    pickup_lng: Optional[float] = None,
    delivery_address: Optional[str] = None,
    delivery_lat: Optional[float] = None,
    delivery_lng: Optional[float] = None,
) -> models.DBDeliveryJob:
    """Internal function to create a delivery job."""
    order = db.query(models.DBOrder).filter(models.DBOrder.id == order_id).first()
    if not order:
        return None

    # Check if delivery job already exists
    existing = db.query(models.DBDeliveryJob).filter(models.DBDeliveryJob.order_id == order_id).first()
    if existing:
        return existing

    # Driver payment mirrors the order amount.
    delivery_fee = float(order.total_amount)

    # Determine delivery details from customer
    if not delivery_address:
        if order.user:
            address_parts = [part for part in [order.user.street, order.user.city, order.user.country] if part]
            delivery_address = ", ".join(address_parts)
        else:
            delivery_address = ""

    # Ensure pickup is in Nablus City if not explicitly provided
    # Standard Nablus coordinates
    nablus_lat, nablus_lng = 32.2211, 35.2544
    if not pickup_address:
        pickup_address = "Nablus City, Palestine"
    if pickup_lat is None:
        pickup_lat = nablus_lat
    if pickup_lng is None:
        pickup_lng = nablus_lng

    # Geocode delivery address if not explicitly provided
    if delivery_lat is None or delivery_lng is None:
        if delivery_address:
            # Try to geocode the full address
            coords = geocode_address_with_fallback(delivery_address, fallback=None)
            
            # If full address fails, try just city and country as a broader fallback
            if not coords and order.user and order.user.city:
                city_country = f"{order.user.city}, {order.user.country}" if order.user.country else order.user.city
                coords = geocode_address_with_fallback(city_country, fallback=None)

            if coords:
                delivery_lat, delivery_lng = coords
            else:
                delivery_lat, delivery_lng = nablus_lat, nablus_lng
        else:
            delivery_lat, delivery_lng = nablus_lat, nablus_lng

    job = models.DBDeliveryJob(
        order_id=order_id,
        status="available",
        pickup_address=pickup_address,
        pickup_latitude=pickup_lat,
        pickup_longitude=pickup_lng,
        delivery_address=delivery_address,
        delivery_latitude=delivery_lat,
        delivery_longitude=delivery_lng,
        payment_amount=delivery_fee,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Reload with relationships
    return _load_job_query(db).filter(models.DBDeliveryJob.id == job.id).first()


@router.post("/create-job", response_model=schemas.DeliveryJobResponse)
def create_delivery_job(
    order_id: int,
    pickup_address: Optional[str] = None,
    pickup_lat: Optional[float] = None,
    pickup_lng: Optional[float] = None,
    delivery_address: Optional[str] = None,
    delivery_lat: Optional[float] = None,
    delivery_lng: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Create a delivery job for an order (Admin only)."""
    job = internal_create_delivery_job(
        order_id, db, pickup_address, pickup_lat, pickup_lng, 
        delivery_address, delivery_lat, delivery_lng
    )
    if not job:
         raise HTTPException(status_code=404, detail="Order not found")
    
    return _job_to_response(job)

@router.get("/jobs/by-order/{order_id}", response_model=schemas.DeliveryJobResponse)
def get_delivery_job_by_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    """Get the active delivery job for a specific order."""
    job = (
        _load_job_query(db)
        .filter(models.DBDeliveryJob.order_id == order_id)
        .first()
    )

    if not job:
        raise HTTPException(status_code=404, detail="Delivery job not found for this order")

    # Fetch the full user to check role
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if job.order.user_id != user.id and user.role not in ["admin", "employee"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this delivery job")

    return _job_to_response(job)


# ─── Chat System (WebSockets & REST) ──────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # Dictionary mapping job_id to a list of connected WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: int):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)

    def disconnect(self, websocket: WebSocket, job_id: int):
        if job_id in self.active_connections:
            if websocket in self.active_connections[job_id]:
                self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def broadcast(self, message: dict, job_id: int):
        if job_id in self.active_connections:
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    print(f"Error broadcasting message: {e}")

manager = ConnectionManager()

@router.get("/jobs/{job_id}/chat", response_model=List[schemas.DeliveryChatMessageResponse])
def get_chat_history(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    """Get chat history for a delivery job."""
    job = db.query(models.DBDeliveryJob).options(joinedload(models.DBDeliveryJob.order)).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check permission (must be driver or customer)
    if job.driver_id != current_user.id and (not job.order or job.order.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this chat")

    messages = (
        db.query(models.DBDeliveryChatMessage)
        .options(joinedload(models.DBDeliveryChatMessage.sender))
        .filter(models.DBDeliveryChatMessage.delivery_job_id == job_id)
        .order_by(models.DBDeliveryChatMessage.created_at.asc())
        .all()
    )

    result = []
    for msg in messages:
        result.append({
            "id": msg.id,
            "delivery_job_id": msg.delivery_job_id,
            "sender_id": msg.sender_id,
            "sender_name": f"{msg.sender.first_name} {msg.sender.last_name}" if msg.sender else "Unknown",
            "message": msg.message,
            "created_at": msg.created_at
        })
    return result


@router.post("/jobs/{job_id}/chat", response_model=schemas.DeliveryChatMessageResponse)
def send_chat_message(
    job_id: int,
    payload: schemas.DeliveryChatMessageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    """Send a chat message via REST (fallback when WebSocket is unavailable)."""
    job = db.query(models.DBDeliveryJob).options(joinedload(models.DBDeliveryJob.order)).filter(models.DBDeliveryJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Fetch the full user object for permission check and sender name
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Check permission (must be driver or customer)
    if job.driver_id != user.id and (not job.order or job.order.user_id != user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this chat")

    new_msg = models.DBDeliveryChatMessage(
        delivery_job_id=job_id,
        sender_id=user.id,
        message=payload.message,
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return {
        "id": new_msg.id,
        "delivery_job_id": new_msg.delivery_job_id,
        "sender_id": new_msg.sender_id,
        "sender_name": f"{user.first_name} {user.last_name}",
        "message": new_msg.message,
        "created_at": new_msg.created_at,
    }


@router.websocket("/jobs/{job_id}/ws/chat")
async def websocket_chat(websocket: WebSocket, job_id: int, token: str):
    """WebSocket endpoint for real-time delivery chat."""
    from fastapi import status as http_status
    from app.OAuth2 import verify_access_token
    from app.database import SessionLocal

    credentials_exception = HTTPException(
        status_code=http_status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    # --- Authenticate & authorise with a short-lived session ---
    try:
        token_data = verify_access_token(token, credentials_exception)
        user_id = token_data.id
    except Exception:
        await websocket.close(code=1008)
        return

    auth_db = SessionLocal()
    try:
        user = auth_db.query(models.DBUser).filter(models.DBUser.id == user_id).first()
        if not user:
            await websocket.close(code=1008)
            return

        # Validate token version (matches get_current_user behaviour)
        user_token_version = user.token_version if user.token_version is not None else 0
        token_token_version = token_data.token_version if token_data.token_version is not None else 0
        if user_token_version != token_token_version:
            await websocket.close(code=1008)
            return

        # Keep lightweight user info for broadcasting
        sender_id = user.id
        sender_name = f"{user.first_name} {user.last_name}"

        # Validate access to the job
        job = (
            auth_db.query(models.DBDeliveryJob)
            .options(joinedload(models.DBDeliveryJob.order))
            .filter(models.DBDeliveryJob.id == job_id)
            .first()
        )
        if not job:
            await websocket.close(code=1008)
            return

        is_driver = (job.driver_id == sender_id)
        is_customer = (job.order and job.order.user_id == sender_id)

        if not (is_driver or is_customer):
            await websocket.close(code=1008)
            return
    finally:
        auth_db.close()

    # --- Connection accepted — enter message loop ---
    await manager.connect(websocket, job_id)

    try:
        while True:
            data = await websocket.receive_text()

            # Use a fresh DB session for every message to avoid stale-session issues
            msg_db = SessionLocal()
            try:
                new_msg = models.DBDeliveryChatMessage(
                    delivery_job_id=job_id,
                    sender_id=sender_id,
                    message=data,
                )
                msg_db.add(new_msg)
                msg_db.commit()
                msg_db.refresh(new_msg)

                broadcast_msg = {
                    "id": new_msg.id,
                    "delivery_job_id": job_id,
                    "sender_id": sender_id,
                    "sender_name": sender_name,
                    "message": data,
                    "created_at": new_msg.created_at.isoformat()
                        if new_msg.created_at
                        else datetime.now(timezone.utc).isoformat(),
                }
            except Exception as db_err:
                print(f"Error saving chat message: {db_err}")
                msg_db.rollback()
                # Still broadcast even if DB save failed so the UX isn't broken
                broadcast_msg = {
                    "id": None,
                    "delivery_job_id": job_id,
                    "sender_id": sender_id,
                    "sender_name": sender_name,
                    "message": data,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            finally:
                msg_db.close()

            await manager.broadcast(broadcast_msg, job_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
    except Exception:
        manager.disconnect(websocket, job_id)
