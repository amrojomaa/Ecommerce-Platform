from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from typing import List, Optional, Dict
from datetime import datetime, timezone
import json

from ..database import get_db, SessionLocal
from .. import models, schemas
from .. import OAuth2
from .admin import require_support_agent, require_admin_or_support_manager

router = APIRouter(
    tags=['Tickets']
)


class TicketConnectionManager:
    def __init__(self):
        # Dictionary mapping ticket_id to a list of connected WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, ticket_id: int):
        await websocket.accept()
        if ticket_id not in self.active_connections:
            self.active_connections[ticket_id] = []
        self.active_connections[ticket_id].append(websocket)

    def disconnect(self, websocket: WebSocket, ticket_id: int):
        if ticket_id in self.active_connections:
            if websocket in self.active_connections[ticket_id]:
                self.active_connections[ticket_id].remove(websocket)
            if not self.active_connections[ticket_id]:
                del self.active_connections[ticket_id]

    async def broadcast(self, message: dict, ticket_id: int):
        if ticket_id in self.active_connections:
            for connection in self.active_connections[ticket_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    print(f"Error broadcasting message: {e}")

ticket_manager = TicketConnectionManager()


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
        status="Open",
        employee_id=None
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
    current_user = Depends(require_admin_or_support_manager)
):
    """Get all tickets - Admin/Support Manager."""
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
    employee_user = Depends(require_support_agent)
):
    """Get tickets assigned to the current support agent"""
    tickets = db.query(models.DBTicket).filter(
        models.DBTicket.employee_id == employee_user.id
    ).order_by(models.DBTicket.created_at.desc()).all()
    
    return tickets


@router.get("/tickets/unassigned", response_model=List[schemas.TicketBase])
def get_unassigned_tickets(
    db: Session = Depends(get_db),
    employee_user = Depends(require_support_agent)
):
    """Get all unassigned tickets - Support Agent can see these to claim them"""
    tickets = db.query(models.DBTicket).filter(
        models.DBTicket.employee_id.is_(None),
        models.DBTicket.status == "Open"
    ).order_by(models.DBTicket.created_at.desc()).all()
    
    return tickets


@router.post("/tickets/{ticket_id}/claim", response_model=schemas.TicketBase)
def claim_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    employee_user = Depends(require_support_agent)
):
    """Claim an unassigned ticket"""
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    if ticket.employee_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket is already assigned to an agent"
        )
    
    ticket.employee_id = employee_user.id
    ticket.status = "In Progress"
    ticket.assigned_by = employee_user.id
    ticket.assigned_at = datetime.now(timezone.utc)
    ticket.updated_at = datetime.now(timezone.utc)
    ticket.last_updated_by = employee_user.id
    db.commit()
    db.refresh(ticket)
    
    return ticket


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
    
    # Check permissions: customer can view their own, support agent can view assigned, admin/support manager can view all
    if user.role == "customer" and ticket.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own tickets"
        )
    elif user.role == "support_agent" and ticket.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view tickets assigned to you"
        )
    elif user.role not in ["admin", "support_manager", "support_agent", "customer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this ticket"
        )
    
    return ticket


@router.patch("/tickets/{ticket_id}/assign", response_model=schemas.TicketBase)
def assign_ticket(
    ticket_id: int,
    assignment: schemas.TicketAssign,
    db: Session = Depends(get_db),
    manager_user = Depends(require_admin_or_support_manager)
):
    """Assign a ticket to a support agent - Admin/Support Manager."""
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
            detail="Support Agent not found"
        )
    
    if employee.role != "support_agent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be a support agent"
        )
    
    ticket.employee_id = assignment.employee_id
    ticket.assigned_by = manager_user.id
    ticket.assigned_at = datetime.now(timezone.utc)
    ticket.updated_at = datetime.now(timezone.utc)
    ticket.last_updated_by = manager_user.id
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
    """Update ticket status - Admin or assigned support agent"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check permissions: admin can update any, support agent can update assigned
    if user.role == "support_agent" and ticket.employee_id != current_user.id:
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
async def add_ticket_response(
    ticket_id: int,
    response: schemas.TicketResponseCreate,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Add a response to a ticket - Customer, support agent, or admin"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check permissions: customer can respond to their own, support agent can respond to assigned,
    # admin/support manager can respond to any.
    if user.role == "customer" and ticket.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only respond to your own tickets"
        )
    elif user.role == "support_agent" and ticket.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only respond to tickets assigned to you"
        )
    elif user.role not in ["admin", "support_manager", "support_agent", "customer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to respond to this ticket"
        )
    
    new_response = models.DBTicketResponse(
        message=response.message,
        ticket_id=ticket_id,
        user_id=current_user.id,
        is_chat=response.is_chat
    )
    db.add(new_response)
    ticket.updated_at = datetime.now(timezone.utc)
    ticket.last_updated_by = current_user.id
    db.commit()
    db.refresh(new_response)

    # Broadcast via WebSocket
    broadcast_payload = {
        "id": new_response.id,
        "message": new_response.message,
        "created_at": new_response.created_at.isoformat(),
        "is_chat": new_response.is_chat,
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email
        }
    }
    await ticket_manager.broadcast(broadcast_payload, ticket_id)
    
    return new_response


@router.get("/tickets/chat-list")
def get_chat_list(
    db: Session = Depends(get_db),
    employee_user = Depends(require_support_agent)
):
    """Get list of customers with active tickets assigned to the current agent"""
    tickets = db.query(models.DBTicket)\
        .options(joinedload(models.DBTicket.customer))\
        .filter(
            models.DBTicket.employee_id == employee_user.id,
            models.DBTicket.status != "Closed"
        ).order_by(models.DBTicket.updated_at.desc()).all()
    
    # Group by customer to avoid duplicates if a customer has multiple tickets
    # But usually, it's better to list by ticket if they are separate issues.
    # The user asked for "a list of customers", so I'll group them.
    customers = {}
    for t in tickets:
        if t.customer_id not in customers:
            customers[t.customer_id] = {
                "id": t.customer.id,
                "first_name": t.customer.first_name,
                "last_name": t.customer.last_name,
                "email": t.customer.email,
                "profile_image": t.customer.profile_image,
                "active_ticket_id": t.id,
                "last_message": t.description, # fallback
                "last_updated": t.updated_at
            }
            # Try to get last response
            last_resp = db.query(models.DBTicketResponse)\
                .filter(models.DBTicketResponse.ticket_id == t.id)\
                .order_by(models.DBTicketResponse.created_at.desc()).first()
            if last_resp:
                customers[t.customer_id]["last_message"] = last_resp.message
                customers[t.customer_id]["last_updated"] = last_resp.created_at

    return list(customers.values())


@router.post("/tickets/{ticket_id}/chat-ticket")
def create_chat_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Issue a short-lived token scoped to a ticket chat for WebSocket auth."""
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    # Validate access
    if user.role == "customer" and ticket.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif user.role == "support_agent" and ticket.employee_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif user.role not in ["admin", "support_manager", "support_agent", "customer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    ws_chat_token = OAuth2.create_ticket_ws_token(
        data={"user_id": user.id},
        ticket_id=ticket_id,
        token_version=user.token_version
    )
    return {"ws_chat_token": ws_chat_token}


@router.websocket("/tickets/{ticket_id}/ws/chat")
async def websocket_ticket_chat(websocket: WebSocket, ticket_id: int, token: str):
    """WebSocket endpoint for real-time ticket chat."""
    from fastapi import status as http_status
    
    credentials_exception = HTTPException(
        status_code=http_status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    try:
        token_data, validated_ticket_id = OAuth2.verify_ticket_ws_token(
            token,
            credentials_exception,
            expected_ticket_id=ticket_id,
        )
        user_id = token_data.id
    except Exception:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        user = db.query(models.DBUser).filter(models.DBUser.id == user_id).first()
        if not user or user.token_version != token_data.token_version:
            await websocket.close(code=1008)
            return

        ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
        if not ticket:
            await websocket.close(code=1008)
            return
            
        # Check access
        if user.role == "customer" and ticket.customer_id != user.id:
            await websocket.close(code=1008)
            return
        elif user.role == "support_agent" and ticket.employee_id != user.id:
            await websocket.close(code=1008)
            return
        elif user.role not in ["admin", "support_manager", "support_agent", "customer"]:
            await websocket.close(code=1008)
            return

        sender_info = {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email
        }
    finally:
        db.close()

    await ticket_manager.connect(websocket, ticket_id)

    try:
        while True:
            data = await websocket.receive_text()
            
            # Save message
            db = SessionLocal()
            try:
                new_response = models.DBTicketResponse(
                    message=data,
                    ticket_id=ticket_id,
                    user_id=user_id,
                    is_chat=True
                )
                db.add(new_response)
                ticket_obj = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
                ticket_obj.updated_at = datetime.now(timezone.utc)
                ticket_obj.last_updated_by = user_id
                db.commit()
                db.refresh(new_response)
                
                broadcast_payload = {
                    "id": new_response.id,
                    "message": data,
                    "created_at": new_response.created_at.isoformat(),
                    "is_chat": True,
                    "user": sender_info
                }
                await ticket_manager.broadcast(broadcast_payload, ticket_id)
            except Exception as e:
                print(f"Error saving ticket message: {e}")
                db.rollback()
            finally:
                db.close()

    except WebSocketDisconnect:
        ticket_manager.disconnect(websocket, ticket_id)
    except Exception:
        ticket_manager.disconnect(websocket, ticket_id)


@router.get("/tickets/unread/count")
def get_unread_ticket_count(
    last_viewed: Optional[str] = Query(None, description="ISO format timestamp of when tickets were last viewed"),
    db: Session = Depends(get_db),
    current_user: int = Depends(OAuth2.get_current_user)
):
    """Get count of unread tickets - Admin, Support Agent, or Customer"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    # Parse last_viewed timestamp if provided
    last_viewed_dt = None
    if last_viewed:
        try:
            last_viewed_dt = datetime.fromisoformat(last_viewed.replace('Z', '+00:00'))
            if last_viewed_dt.tzinfo is None:
                last_viewed_dt = last_viewed_dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            last_viewed_dt = None
    
    # Build query based on user role
    if user.role in ["admin", "support_manager"]:
        query = db.query(models.DBTicket)
    elif user.role == "support_agent":
        query = db.query(models.DBTicket).filter(
            models.DBTicket.employee_id == current_user.id
        )
    elif user.role == "customer":
        query = db.query(models.DBTicket).filter(
            models.DBTicket.customer_id == current_user.id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role"
        )
    
    # Exclude resolved and closed tickets from the notification count
    query = query.filter(models.DBTicket.status.notin_(['Resolved', 'Closed']))
    
    # Exclude tickets that were last updated by the current user
    if user.role == "customer":
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
        query = query.filter(
            or_(
                models.DBTicket.last_updated_by != current_user.id,
                models.DBTicket.last_updated_by.is_(None)
            )
        )
    
    # Filter by last_viewed timestamp if provided
    if last_viewed_dt:
        unread_count = query.filter(
            or_(
                models.DBTicket.created_at > last_viewed_dt,
                models.DBTicket.updated_at > last_viewed_dt
            )
        ).count()
    else:
        unread_count = query.count()
    
    return {"unread_count": unread_count}


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin_or_support_manager)
):
    """Delete a ticket - Admin/Support Manager."""
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
    """Request deletion of a ticket - Support Agent only"""
    user = db.query(models.DBUser).filter(models.DBUser.id == current_user.id).first()
    
    if user.role != "support_agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only support agents can request ticket deletion"
        )
    
    ticket = db.query(models.DBTicket).filter(models.DBTicket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check if ticket is assigned to this support agent
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
    current_user = Depends(require_admin_or_support_manager)
):
    """Get all tickets with pending delete requests - Admin/Support Manager."""
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
    current_user = Depends(require_admin_or_support_manager)
):
    """Approve and delete a ticket - Admin/Support Manager."""
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
    current_user = Depends(require_admin_or_support_manager)
):
    """Reject a delete request for a ticket - Admin/Support Manager."""
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
