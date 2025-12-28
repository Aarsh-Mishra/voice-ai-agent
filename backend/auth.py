from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from database import db
from datetime import datetime, timedelta
import jwt
import os

# Import models from models.py (Now this will work!)
from models import UserSignup, UserUpdate

# --- CONFIG ---
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 3000

# Password Hashing Tool
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter()

# --- HELPERS ---
def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
        
    return user

# --- ROUTES ---

# 1. SIGN UP (Feature 2)
@router.post("/signup", status_code=201)
async def signup(user: UserSignup):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user = {
        "email": user.email,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(new_user)
    return {"message": "User created successfully"}

# 2. LOGIN (Standard)
@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db_user = await db.users.find_one({"email": form_data.username})
    
    if not db_user or not verify_password(form_data.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": db_user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

# 3. GET CURRENT USER (NEW)
@router.get("/me")
async def get_user(current_user: dict = Depends(get_current_user)):
    """Get current user's details"""
    return {"email": current_user["email"]}

# 4. UPDATE SETTINGS (Feature 3)
@router.put("/me")
async def update_user(user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user's email or password"""
    update_fields = {}
    
    if user_data.email:
        # Check if email is taken by someone else
        existing = await db.users.find_one({"email": user_data.email})
        if existing and existing["_id"] != current_user["_id"]:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = user_data.email
        
    if user_data.password:
        update_fields["password"] = get_password_hash(user_data.password)
        
    if not update_fields:
        return {"message": "Nothing to update"}
        
    await db.users.update_one({"_id": current_user["_id"]}, {"$set": update_fields})
    return {"message": "Profile updated successfully"}