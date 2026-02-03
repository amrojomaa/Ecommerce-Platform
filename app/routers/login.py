from fastapi import Depends, status, HTTPException, APIRouter
from sqlalchemy.orm import Session
from app import models, schemas
from ..database import get_db
from .. import models, utils, OAuth2
from fastapi.security.oauth2 import OAuth2PasswordRequestForm

router = APIRouter(
     tags=['Login']
)

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def new_user(user : OAuth2PasswordRequestForm = Depends(), db: Session = Depends (get_db), ):#admin_user = Depends(require_admin)):
    users = db.query(models.DBUser).filter(models.DBUser.email == user.username).first()
    if users:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user.password = utils.hash(user.password)
    new_user = models.DBUser(
        email=user.username,
        password=user.password  )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Account created successfully"} 

@router.post("/login")
def get_email(user_credentials: OAuth2PasswordRequestForm = Depends(), db: Session = Depends (get_db)): 

    getuser = db.query(models.DBUser).filter(models.DBUser.email == user_credentials.username).first()
    if not getuser :
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="this is email not a found ")

    if not utils.verify(user_credentials.password, getuser.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="this is password error")
    
    token = OAuth2.create_access_token(data = {"user_id": getuser.id})

    return {"access_token" : token , 
            "token_type" : 'bearer',
            "username" : getuser.email,
            "user_id" : getuser.id}