from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime, timezone

from ..database import get_db
from app import models, schemas
from app import OAuth2
from app.routers.admin import require_admin, require_employee

router = APIRouter(
    tags=['Tickets']
)


@router.post("/tickets/create", status_code=status.HTTP_201_CREATED, response_model=schemas.TicketBase)
def create_ticket(
    ticket: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Create a new ticket - Customer only"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    if user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can create tickets"
        )
    
    new_ticket = models.DBTicket(
        title=ticket.title,
        description=ticket.description,
        customer_id=current_user.id,
        status="In Progress"
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    
    return new_ticket


@router.get("/tickets/my", response_model=List[schemas.TicketBase])
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Get tickets created by the current user (customer)"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    if user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can view their own tickets"
        )
    
    tickets = db.query(models.DBTicket).filter(
        models.DBTicket.customer_id == current_user.id
    ).order_by(models.DBTicket.created_at.desc()).all()
    
    return tickets


@router.get("/tickets/all", response_model=List[schemas.TicketBase])
def get_all_tickets(
    status_filter: Optional[str] = Query(None, description="Filter by status: In Progress, Resolved, Closed"),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Get all tickets - Admin only"""
    query = db.query(models.DBTicket)
    
    if status_filter:
        if status_filter not in ["In Progress", "Resolved", "Closed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be one of: In Progress, Resolved, Closed"
            )
        query = query.filter(models.DBTicket.status == status_filter)
    
    tickets = query.order_by(models.DBTicket.created_at.desc()).all()
    return tickets


@router.get("/tickets/assigned", response_model=List[schemas.TicketBase])
def get_assigned_tickets(
    db: Session = Depends(get_db),
    employee_user = Depends(require_employee)
):
    """Get tickets assigned to the current employee"""
    tickets = db.query(models.DBTicket).filter(
        models.DBTicket.employee_id == employee_user.id
    ).order_by(models.DBTicket.created_at.desc()).all()
    
    return tickets


@router.get("/tickets/{ticket_id:int}", response_model=schemas.TicketBase)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Get a specific ticket by ID"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check permissions: customer can view their own, employee can view assigned, admin can view all
    if user.role == "customer" and ticket.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own tickets"
        )
    elif user.role == "employee" and ticket.employee_id != current_user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view tickets assigned to you"
        )
    
    return ticket


@router.patch("/tickets/{ticket_id}/assign", response_model=schemas.TicketBase)
def assign_ticket(
    ticket_id: int,
    assignment: schemas.TicketAssign,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Assign a ticket to an employee - Admin only"""
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    employee = db.query(models.DBUser).filter(models.DBUser.id == assignment.employee_id).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    if employee.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be an employee"
        )
    
    ticket.employee_id = assignment.employee_id
    ticket.updated_at = datetime.now(timezone.utc)
    ticket.last_updated_by = admin_user.id
    db.commit()
    db.refresh(ticket)
    
    return ticket


@router.patch("/tickets/{ticket_id}/status", response_model=schemas.TicketBase)
def update_ticket_status(
    ticket_id: int,
    status_update: schemas.TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Update ticket status - Admin or assigned employee"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check permissions: admin can update any, employee can update assigned
    if user.role == "employee" and ticket.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update tickets assigned to you"
        )
    elif user.role == "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customers cannot update ticket status"
        )
    
    ticket.status = status_update.status
    ticket.updated_at = datetime.now(timezone.utc)
    ticket.last_updated_by = current_user.id
    db.commit()
    db.refresh(ticket)
    
    return ticket


@router.post("/tickets/{ticket_id}/response", status_code=status.HTTP_201_CREATED, response_model=schemas.TicketResponseMessage)
def add_ticket_response(
    ticket_id: int,
    response: schemas.TicketResponseCreate,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Add a response to a ticket - Customer, employee, or admin"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check permissions: customer can respond to their own, employee/admin can respond to any
    if user.role == "customer" and ticket.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only respond to your own tickets"
        )
    elif user.role == "employee" and ticket.employee_id != current_user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only respond to tickets assigned to you"
        )
    
    new_response = models.DBTicketResponse(
        message=response.message,
        ticket_id=ticket_id,
        user_id=current_user.id
    )
    db.add(new_response)
    ticket.updated_at = datetime.now(timezone.utc)
    ticket.last_updated_by = current_user.id
    db.commit()
    db.refresh(new_response)
    
    return new_response


@router.get("/tickets/unread/count")
def get_unread_ticket_count(
    last_viewed: Optional[str] = Query(None, description="ISO format timestamp of when tickets were last viewed"),
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Get count of unread tickets - Admin, Employee, or Customer
    
    Unread tickets are those that:
    - Have been created after last_viewed timestamp, OR
    - Have been updated (new responses) after last_viewed timestamp
    
    - Admin sees all tickets
    - Employee sees only assigned tickets
    - Customer sees only their own tickets
    """
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    # Parse last_viewed timestamp if provided
    last_viewed_dt = None
    if last_viewed:
        try:
            last_viewed_dt = datetime.fromisoformat(last_viewed.replace('Z', '+00:00'))
            if last_viewed_dt.tzinfo is None:
                last_viewed_dt = last_viewed_dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            # If invalid timestamp, treat as no last_viewed (show all as unread)
            last_viewed_dt = None
    
    # Build query based on user role
    if user.role == "admin":
        # Admin sees all tickets
        query = db.query(models.DBTicket)
    elif user.role == "employee":
        # Employee sees only assigned tickets
        query = db.query(models.DBTicket).filter(
            models.DBTicket.employee_id == current_user.id
        )
    elif user.role == "customer":
        # Customer sees only their own tickets
        query = db.query(models.DBTicket).filter(
            models.DBTicket.customer_id == current_user.id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role"
        )
    
    # Exclude tickets that were last updated by the current user
    # (users shouldn't see notifications for tickets they themselves updated)
    if user.role == "customer":
        # For customers: exclude tickets they updated (last_updated_by == customer.id)
        # Also exclude tickets they just created (last_updated_by is None AND customer_id == customer.id)
        query = query.filter(
            and_(
                or_(
                    models.DBTicket.last_updated_by != current_user.id,
                    models.DBTicket.last_updated_by.is_(None)
                ),
                or_(
                    models.DBTicket.last_updated_by.isnot(None),
                    models.DBTicket.customer_id != current_user.id
                )
            )
        )
    else:
        # For admin and employee: exclude tickets they updated
        # (they should see notifications for newly created tickets where last_updated_by is None)
        query = query.filter(
            or_(
                models.DBTicket.last_updated_by != current_user.id,
                models.DBTicket.last_updated_by.is_(None)
            )
        )
    
    # Filter by last_viewed timestamp if provided
    if last_viewed_dt:
        # Count tickets created or updated after last_viewed
        unread_count = query.filter(
            or_(
                models.DBTicket.created_at > last_viewed_dt,
                models.DBTicket.updated_at > last_viewed_dt
            )
        ).count()
    else:
        # If no last_viewed, count all tickets as unread
        unread_count = query.count()
    
    return {"unread_count": unread_count}


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Delete a ticket - Admin only"""
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    db.delete(ticket)
    db.commit()
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tickets/{ticket_id}/request-delete", status_code=status.HTTP_200_OK)
def request_delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Request deletion of a ticket - Employee only"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    if user.role != "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employees can request ticket deletion"
        )
    
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check if ticket is assigned to this employee
    if ticket.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only request deletion of tickets assigned to you"
        )
    
    ticket.pending_delete = True
    ticket.delete_requested_by = current_user.id
    ticket.delete_requested_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    
    return {"message": "Delete request submitted successfully", "ticket": ticket}


@router.get("/tickets/pending-deletes", response_model=List[schemas.TicketBase])
def get_pending_deletes(
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Get all tickets with pending delete requests - Admin only"""
    tickets = db.query(models.DBTicket)\
        .options(
            joinedload(models.DBTicket.customer),
            joinedload(models.DBTicket.employee)
        )\
        .filter(models.DBTicket.pending_delete == True)\
        .order_by(models.DBTicket.delete_requested_at.desc())\
        .all()
    
    return tickets


@router.post("/tickets/{ticket_id}/approve-delete", status_code=status.HTTP_200_OK)
def approve_delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Approve and delete a ticket - Admin only"""
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    if not ticket.pending_delete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This ticket does not have a pending delete request"
        )
    
    db.delete(ticket)
    db.commit()
    
    return {"message": "Ticket deleted successfully"}


@router.post("/tickets/{ticket_id}/reject-delete", status_code=status.HTTP_200_OK)
def reject_delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Reject a delete request for a ticket - Admin only"""
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    if not ticket.pending_delete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This ticket does not have a pending delete request"
        )
    
    ticket.pending_delete = False
    ticket.delete_requested_by = None
    ticket.delete_requested_at = None
    db.commit()
    db.refresh(ticket)
    
    return {"message": "Delete request rejected", "ticket": ticket}