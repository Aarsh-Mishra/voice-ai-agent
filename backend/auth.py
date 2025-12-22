# backend/auth.py
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm # <--- Added this import
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from database import db
from datetime import datetime, timedelta
import jwt
import os

# --- CONFIG ---
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 3000

# Password Hashing Tool
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter()

# --- MODELS ---
class UserSignup(BaseModel):
    email: EmailStr
    password: str

# (UserLogin model is no longer needed for the standard Swagger flow)

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

# --- UPDATED LOGIN ROUTE ---
# Now accepts standard OAuth2 Form Data (compatible with Swagger UI)
@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Note: OAuth2 standard uses 'username' field, so we map it to our 'email'
    db_user = await db.users.find_one({"email": form_data.username})
    
    if not db_user or not verify_password(form_data.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": db_user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}