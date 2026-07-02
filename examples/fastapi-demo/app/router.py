from fastapi import APIRouter

router = APIRouter()

@router.get("/items")
def read_items():
    return [{"item_id": 1}]
