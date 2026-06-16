from fastapi import APIRouter, Query

from models.logs import LogListResponse

router = APIRouter(prefix="/api", tags=["logs"])


@router.get("/logs", response_model=LogListResponse)
def get_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> LogListResponse:
    """Query log — empty until D1 17:00 logging middleware is wired."""
    return LogListResponse(total=0, page=page, page_size=page_size, items=[])
