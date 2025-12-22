# backend/agents.py
from fastapi import APIRouter, Depends, HTTPException, status
from database import db
from models import AgentCreate, AgentUpdate, AgentResponse
from auth import get_current_user
from bson import ObjectId
from typing import List

router = APIRouter()

# Helper to fix MongoDB _id formatting
def fix_id(doc):
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

@router.post("/", response_model=AgentResponse)
async def create_agent(agent: AgentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new agent for the logged-in user"""
    new_agent = agent.dict()
    new_agent["user_id"] = str(current_user["_id"])
    
    result = await db.agents.insert_one(new_agent)
    created_agent = await db.agents.find_one({"_id": result.inserted_id})
    return fix_id(created_agent)

@router.get("/", response_model=List[AgentResponse])
async def get_my_agents(current_user: dict = Depends(get_current_user)):
    """List only the current user's agents"""
    agents_cursor = db.agents.find({"user_id": str(current_user["_id"])})
    agents = await agents_cursor.to_list(length=100)
    return [fix_id(a) for a in agents]

@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: str, update_data: AgentUpdate, current_user: dict = Depends(get_current_user)):
    """Update an agent"""
    if not ObjectId.is_valid(agent_id):
        raise HTTPException(status_code=400, detail="Invalid Agent ID")
    
    query = {"_id": ObjectId(agent_id), "user_id": str(current_user["_id"])}
    update_fields = {k: v for k, v in update_data.dict().items() if v is not None}

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.agents.update_one(query, {"$set": update_fields})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    updated_agent = await db.agents.find_one(query)
    return fix_id(updated_agent)

@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an agent"""
    if not ObjectId.is_valid(agent_id):
        raise HTTPException(status_code=400, detail="Invalid Agent ID")

    result = await db.agents.delete_one({"_id": ObjectId(agent_id), "user_id": str(current_user["_id"])})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    return {"message": "Agent deleted successfully"}