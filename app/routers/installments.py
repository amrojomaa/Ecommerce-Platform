import json
import os
import calendar
import stripe
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app import OAuth2, models, schemas
from app.database import get_db
from app.routers.admin import require_admin_or_operations_manager
from app.utils.image_storage import delete_local_image, save_uploaded_image


router = APIRouter(tags=["Installments"])
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

ALLOWED_DOCUMENT_TYPES = {"id_front", "id_back", "selfie_with_id"}
ACTIVE_INSTALLMENT_STATUSES = {"pending", "approved"}


def _parse_selected_item_ids(raw: Optional[str]) -> Optional[List[int]]:
    if not raw:
        return None

    text = raw.strip()
    if not text:
        return None

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            ids = [int(item) for item in parsed]
            return list(dict.fromkeys(ids))
    except json.JSONDecodeError:
        pass

    try:
        ids = [int(chunk.strip()) for chunk in text.split(",") if chunk.strip()]
        if ids:
            return list(dict.fromkeys(ids))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="selected_item_ids must be a JSON array or comma-separated integers",
        ) from exc

    return None


def _ensure_valid_image(file: UploadFile, label: str) -> None:
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} is required",
        )
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} must be an image file",
        )


def _save_document(request_id: int, doc_type: str, file: UploadFile) -> str:
    if doc_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported document type",
        )

    _ensure_valid_image(file, doc_type)

    return save_uploaded_image(
        file,
        f"installments/{request_id}/{doc_type}",
        max_bytes=10 * 1024 * 1024,
    )


def _delete_file_if_exists(path: Optional[str]) -> None:
    if not path:
        return
    delete_local_image(path)


def _add_months(source: datetime, months: int) -> datetime:
    month_index = source.month - 1 + months
    year = source.year + month_index // 12
    month = (month_index % 12) + 1
    day = min(source.day, calendar.monthrange(year, month)[1])
    return source.replace(year=year, month=month, day=day)


def _build_request_query(db: Session):
    return db.query(models.DBInstallmentRequest).options(
        joinedload(models.DBInstallmentRequest.order),
        joinedload(models.DBInstallmentRequest.user),
        joinedload(models.DBInstallmentRequest.reviewer),
        selectinload(models.DBInstallmentRequest.items),
        selectinload(models.DBInstallmentRequest.documents),
        selectinload(models.DBInstallmentRequest.schedules),
        selectinload(models.DBInstallmentRequest.payments),
    )


def _get_installment_request_or_404(db: Session, request_id: int) -> models.DBInstallmentRequest:
    installment_request = (
        _build_request_query(db)
        .filter(models.DBInstallmentRequest.id == request_id)
        .first()
    )
    if not installment_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installment request not found",
        )
    return installment_request


def _ensure_owner_request_or_403(
    db: Session, request_id: int, user_id: int
) -> models.DBInstallmentRequest:
    installment_request = _get_installment_request_or_404(db, request_id)
    if installment_request.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this installment request",
        )
    return installment_request


def _mark_schedule_as_paid(
    db: Session,
    installment_request: models.DBInstallmentRequest,
    request_id: int,
    schedule_id: int,
    payload: schemas.InstallmentMarkPaidPayload,
    marked_by_user_id: int,
) -> models.DBInstallmentRequest:
    if installment_request.status not in {"approved", "completed"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Installment request must be approved before payments can be marked",
        )

    schedule = (
        db.query(models.DBInstallmentSchedule)
        .filter(
            models.DBInstallmentSchedule.id == schedule_id,
            models.DBInstallmentSchedule.request_id == request_id,
        )
        .first()
    )
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installment schedule not found",
        )
    if schedule.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This installment has already been marked as paid",
        )

    paid_at = payload.paid_at or datetime.now(timezone.utc)
    amount_paid = float(schedule.amount_due)
    schedule.amount_paid = amount_paid
    schedule.status = "paid"
    schedule.paid_at = paid_at

    db.add(
        models.DBInstallmentPayment(
            request_id=request_id,
            schedule_id=schedule_id,
            amount=amount_paid,
            note=(payload.note or "").strip() or None,
            marked_by=marked_by_user_id,
            paid_at=paid_at,
        )
    )

    all_schedules = (
        db.query(models.DBInstallmentSchedule)
        .filter(models.DBInstallmentSchedule.request_id == request_id)
        .order_by(models.DBInstallmentSchedule.installment_number.asc())
        .all()
    )
    remaining_balance = round(
        sum(max(float(item.amount_due) - float(item.amount_paid or 0), 0) for item in all_schedules),
        2,
    )
    pending_schedules = [item for item in all_schedules if item.status != "paid"]

    installment_request.remaining_balance = remaining_balance
    installment_request.next_payment_date = pending_schedules[0].due_date if pending_schedules else None
    if remaining_balance <= 0:
        installment_request.status = "completed"
        if installment_request.order and installment_request.order.status == "created":
            installment_request.order.status = "paid"
    elif installment_request.status == "completed":
        installment_request.status = "approved"

    db.commit()
    return _get_installment_request_or_404(db, request_id)


@router.post("/installments/requests", response_model=schemas.InstallmentRequestResponse, status_code=status.HTTP_201_CREATED)
def create_installment_request(
    order_id: int = Form(...),
    duration_months: int = Form(...),
    selected_item_ids: Optional[str] = Form(None),
    user_note: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    id_front: UploadFile = File(...),
    id_back: UploadFile = File(...),
    selfie_with_id: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    if duration_months < 1 or duration_months > 36:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="duration_months must be between 1 and 36",
        )

    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    normalized_phone = (phone or "").strip() or None
    if not (user.phone or "").strip() and not normalized_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is required before submitting an installment request",
        )
    if normalized_phone:
        user.phone = normalized_phone

    order = (
        db.query(models.DBOrder)
        .options(
            selectinload(models.DBOrder.orderitems)
            .joinedload(models.DBOrderItem.product)
        )
        .filter(
            models.DBOrder.id == order_id,
            models.DBOrder.user_id == current_user.id,
        )
        .first()
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    if not order.orderitems:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order has no items",
        )
    if order.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request installments for a cancelled order",
        )

    existing_active = (
        db.query(models.DBInstallmentRequest)
        .filter(
            models.DBInstallmentRequest.order_id == order.id,
            models.DBInstallmentRequest.status.in_(ACTIVE_INSTALLMENT_STATUSES),
        )
        .first()
    )
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This order already has an active installment request",
        )

    parsed_ids = _parse_selected_item_ids(selected_item_ids)
    if parsed_ids is not None:
        selected_items = [item for item in order.orderitems if item.id in parsed_ids]
    else:
        selected_items = list(order.orderitems)

    if not selected_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one order item must be selected",
        )

    selected_subtotal = round(sum(float(item.total) for item in selected_items), 2)
    order_subtotal = round(sum(float(item.total) for item in order.orderitems), 2)
    order_promotion_discount = round(float(getattr(order, "promotion_discount", 0) or 0), 2)

    selected_discount = 0.0
    if order_subtotal > 0 and order_promotion_discount > 0:
        selected_ratio = min(max(selected_subtotal / order_subtotal, 0), 1)
        selected_discount = round(order_promotion_discount * selected_ratio, 2)
        selected_discount = min(selected_discount, selected_subtotal)

    total_amount = round(selected_subtotal - selected_discount, 2)
    if total_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Installment total amount must be greater than zero",
        )

    monthly_payment = round(total_amount / duration_months, 2)
    installment_request = models.DBInstallmentRequest(
        user_id=current_user.id,
        order_id=order.id,
        duration_months=duration_months,
        total_amount=total_amount,
        remaining_balance=total_amount,
        monthly_payment=monthly_payment,
        user_note=(user_note or "").strip() or None,
    )
    db.add(installment_request)
    db.flush()

    for order_item in selected_items:
        product_name = order_item.product.name if order_item.product else f"Product #{order_item.product_id}"
        db.add(
            models.DBInstallmentRequestItem(
                request_id=installment_request.id,
                order_item_id=order_item.id,
                product_id=order_item.product_id,
                product_name=product_name,
                quantity=order_item.quantity,
                unit_price=float(order_item.price),
                total=float(order_item.total),
            )
        )

    document_files = {
        "id_front": id_front,
        "id_back": id_back,
        "selfie_with_id": selfie_with_id,
    }
    for doc_type, upload in document_files.items():
        saved_path = _save_document(installment_request.id, doc_type, upload)
        db.add(
            models.DBInstallmentDocument(
                request_id=installment_request.id,
                document_type=doc_type,
                file_path=saved_path,
            )
        )

    db.commit()
    return _get_installment_request_or_404(db, installment_request.id)


@router.get("/installments/my", response_model=List[schemas.InstallmentRequestResponse])
def get_my_installment_requests(
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    return (
        _build_request_query(db)
        .filter(models.DBInstallmentRequest.user_id == current_user.id)
        .order_by(models.DBInstallmentRequest.created_at.desc())
        .all()
    )


@router.get("/installments/my/{request_id}", response_model=schemas.InstallmentRequestResponse)
def get_my_installment_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    installment_request = _get_installment_request_or_404(db, request_id)
    if installment_request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this installment request",
        )
    return installment_request


@router.patch("/installments/my/{request_id}", response_model=schemas.InstallmentRequestResponse)
def update_my_installment_request(
    request_id: int,
    payload: schemas.InstallmentRequestUpdatePayload,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    installment_request = _ensure_owner_request_or_403(db, request_id, current_user.id)
    if installment_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be edited",
        )

    if payload.duration_months is None and payload.user_note is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update fields provided",
        )

    if payload.duration_months is not None:
        if payload.duration_months < 1 or payload.duration_months > 36:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="duration_months must be between 1 and 36",
            )
        installment_request.duration_months = payload.duration_months
        installment_request.monthly_payment = round(
            float(installment_request.total_amount) / payload.duration_months,
            2,
        )
        installment_request.remaining_balance = round(float(installment_request.total_amount), 2)

    if payload.user_note is not None:
        installment_request.user_note = (payload.user_note or "").strip() or None

    db.commit()
    return _get_installment_request_or_404(db, request_id)


@router.patch(
    "/installments/my/{request_id}/documents/{document_type}",
    response_model=schemas.InstallmentRequestResponse,
)
def upsert_my_installment_document(
    request_id: int,
    document_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    normalized_type = (document_type or "").strip().lower()
    if normalized_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document type",
        )

    installment_request = _ensure_owner_request_or_403(db, request_id, current_user.id)
    if installment_request.status not in {"pending", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents can only be edited while request is pending or rejected",
        )

    saved_path = _save_document(request_id, normalized_type, file)
    existing_document = (
        db.query(models.DBInstallmentDocument)
        .filter(
            models.DBInstallmentDocument.request_id == request_id,
            models.DBInstallmentDocument.document_type == normalized_type,
        )
        .first()
    )

    if existing_document:
        has_other_reference = (
            db.query(models.DBInstallmentDocument.id)
            .filter(
                models.DBInstallmentDocument.file_path == existing_document.file_path,
                models.DBInstallmentDocument.id != existing_document.id,
            )
            .first()
        )
        if not has_other_reference:
            _delete_file_if_exists(existing_document.file_path)
        existing_document.file_path = saved_path
        existing_document.created_at = datetime.now(timezone.utc)
    else:
        db.add(
            models.DBInstallmentDocument(
                request_id=request_id,
                document_type=normalized_type,
                file_path=saved_path,
            )
        )

    db.commit()
    return _get_installment_request_or_404(db, request_id)


@router.delete(
    "/installments/my/{request_id}/documents/{document_id}",
    response_model=schemas.InstallmentRequestResponse,
)
def delete_my_installment_document(
    request_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    installment_request = _ensure_owner_request_or_403(db, request_id, current_user.id)
    if installment_request.status not in {"pending", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents can only be deleted while request is pending or rejected",
        )

    document = (
        db.query(models.DBInstallmentDocument)
        .filter(
            models.DBInstallmentDocument.id == document_id,
            models.DBInstallmentDocument.request_id == request_id,
        )
        .first()
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    has_other_reference = (
        db.query(models.DBInstallmentDocument.id)
        .filter(
            models.DBInstallmentDocument.file_path == document.file_path,
            models.DBInstallmentDocument.id != document.id,
        )
        .first()
    )
    if not has_other_reference:
        _delete_file_if_exists(document.file_path)
    db.delete(document)
    db.commit()
    return _get_installment_request_or_404(db, request_id)


@router.patch(
    "/installments/my/{request_id}/cancel",
    response_model=schemas.InstallmentRequestResponse,
)
def cancel_my_installment_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    installment_request = _ensure_owner_request_or_403(db, request_id, current_user.id)
    if installment_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be cancelled",
        )

    installment_request.status = "cancelled"
    installment_request.next_payment_date = None
    installment_request.reviewed_by = None
    installment_request.reviewed_at = None

    schedules = (
        db.query(models.DBInstallmentSchedule)
        .filter(models.DBInstallmentSchedule.request_id == request_id)
        .all()
    )
    for schedule in schedules:
        if schedule.status == "pending":
            schedule.status = "cancelled"

    remaining_balance = round(
        sum(max(float(item.amount_due) - float(item.amount_paid or 0), 0) for item in schedules),
        2,
    )
    installment_request.remaining_balance = remaining_balance

    db.commit()
    return _get_installment_request_or_404(db, request_id)


@router.get("/installments/admin/requests", response_model=List[schemas.InstallmentRequestResponse])
def list_installment_requests_for_admin(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.DBUser = Depends(require_admin_or_operations_manager),
):
    query = _build_request_query(db)
    if status_filter:
        query = query.filter(models.DBInstallmentRequest.status == status_filter.strip().lower())
    return query.order_by(models.DBInstallmentRequest.created_at.desc()).all()


@router.get("/installments/admin/requests/{request_id}", response_model=schemas.InstallmentRequestResponse)
def get_installment_request_for_admin(
    request_id: int,
    db: Session = Depends(get_db),
    _: models.DBUser = Depends(require_admin_or_operations_manager),
):
    return _get_installment_request_or_404(db, request_id)


@router.patch("/installments/admin/requests/{request_id}/review", response_model=schemas.InstallmentRequestResponse)
def review_installment_request(
    request_id: int,
    payload: schemas.InstallmentReviewPayload,
    db: Session = Depends(get_db),
    reviewer: models.DBUser = Depends(require_admin_or_operations_manager),
):
    installment_request = _get_installment_request_or_404(db, request_id)
    if installment_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be reviewed",
        )

    available_types = {
        doc.document_type
        for doc in db.query(models.DBInstallmentDocument)
        .filter(models.DBInstallmentDocument.request_id == request_id)
        .all()
    }
    if payload.action == "approve" and not ALLOWED_DOCUMENT_TYPES.issubset(available_types):
        missing = sorted(ALLOWED_DOCUMENT_TYPES - available_types)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request. Missing required documents: {', '.join(missing)}",
        )

    now = datetime.now(timezone.utc)
    installment_request.reviewed_by = reviewer.id
    installment_request.reviewed_at = now
    installment_request.admin_note = (payload.admin_note or "").strip() or None

    if payload.action == "reject":
        installment_request.status = "rejected"
        installment_request.next_payment_date = None
        db.commit()
        return _get_installment_request_or_404(db, request_id)

    installment_request.status = "approved"
    db.query(models.DBInstallmentSchedule).filter(
        models.DBInstallmentSchedule.request_id == installment_request.id
    ).delete()

    duration = installment_request.duration_months
    total_amount = float(installment_request.total_amount)
    base_amount = round(total_amount / duration, 2)
    first_due_date = _add_months(now, 1)
    running_total = 0.0

    for idx in range(duration):
        installment_number = idx + 1
        if installment_number == duration:
            amount_due = round(total_amount - running_total, 2)
        else:
            amount_due = base_amount
            running_total += amount_due

        db.add(
            models.DBInstallmentSchedule(
                request_id=installment_request.id,
                installment_number=installment_number,
                due_date=_add_months(first_due_date, idx),
                amount_due=amount_due,
                amount_paid=0,
                status="pending",
            )
        )

    installment_request.remaining_balance = round(total_amount, 2)
    installment_request.monthly_payment = base_amount
    installment_request.next_payment_date = first_due_date

    db.commit()
    try:
        from app.routers.delivery import internal_create_delivery_job

        internal_create_delivery_job(installment_request.order_id, db)
    except Exception:
        # Do not block approval flow if delivery job creation fails unexpectedly.
        pass

    return _get_installment_request_or_404(db, request_id)


@router.patch(
    "/installments/my/{request_id}/schedules/{schedule_id}/pay",
    response_model=schemas.InstallmentRequestResponse,
)
def mark_my_installment_schedule_paid(
    request_id: int,
    schedule_id: int,
    payload: schemas.InstallmentStripePayPayload,
    db: Session = Depends(get_db),
    current_user=Depends(OAuth2.get_current_user),
):
    payment_intent_id = (payload.payment_intent_id or "").strip()
    if not payment_intent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="payment_intent_id is required",
        )

    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(exc)}",
        ) from exc

    if intent.status != "succeeded":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment not completed. Stripe status: {intent.status}",
        )

    metadata = intent.metadata or {}
    metadata_user_id = str(metadata.get("user_id", "")).strip()
    metadata_request_id = str(metadata.get("installment_request_id", "")).strip()
    metadata_schedule_id = str(metadata.get("installment_schedule_id", "")).strip()

    if metadata_user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This payment intent does not belong to the current user",
        )
    if metadata_request_id != str(request_id) or metadata_schedule_id != str(schedule_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment intent does not match this installment schedule",
        )

    installment_request = _ensure_owner_request_or_403(db, request_id, current_user.id)
    return _mark_schedule_as_paid(
        db=db,
        installment_request=installment_request,
        request_id=request_id,
        schedule_id=schedule_id,
        payload=schemas.InstallmentMarkPaidPayload(note=payload.note),
        marked_by_user_id=current_user.id,
    )


@router.patch(
    "/installments/admin/requests/{request_id}/schedules/{schedule_id}/pay",
    response_model=schemas.InstallmentRequestResponse,
)
def mark_installment_schedule_paid(
    request_id: int,
    schedule_id: int,
    payload: schemas.InstallmentMarkPaidPayload,
    db: Session = Depends(get_db),
    reviewer: models.DBUser = Depends(require_admin_or_operations_manager),
):
    _ = request_id, schedule_id, payload, db, reviewer
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the customer can mark installment payments as paid",
    )


@router.patch(
    "/installments/admin/requests/{request_id}/cancel",
    response_model=schemas.InstallmentRequestResponse,
)
def cancel_installment_request(
    request_id: int,
    payload: schemas.InstallmentCancelPayload,
    db: Session = Depends(get_db),
    reviewer: models.DBUser = Depends(require_admin_or_operations_manager),
):
    installment_request = _get_installment_request_or_404(db, request_id)
    if installment_request.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Installment request is already cancelled",
        )
    if installment_request.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed installment requests cannot be cancelled",
        )

    now = datetime.now(timezone.utc)
    installment_request.status = "cancelled"
    installment_request.next_payment_date = None
    installment_request.reviewed_by = reviewer.id
    installment_request.reviewed_at = now
    if payload.admin_note is not None:
        installment_request.admin_note = (payload.admin_note or "").strip() or None

    schedules = (
        db.query(models.DBInstallmentSchedule)
        .filter(models.DBInstallmentSchedule.request_id == request_id)
        .all()
    )
    for schedule in schedules:
        if schedule.status == "pending":
            schedule.status = "cancelled"

    remaining_balance = round(
        sum(max(float(item.amount_due) - float(item.amount_paid or 0), 0) for item in schedules),
        2,
    )
    installment_request.remaining_balance = remaining_balance

    db.commit()
    return _get_installment_request_or_404(db, request_id)
