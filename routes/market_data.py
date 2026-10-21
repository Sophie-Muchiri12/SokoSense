from fastapi import APIRouter, Depends, Query

from auth.security import get_current_user

from engines.market_prices import get_market_prices
from models.market_map import MarketMapResponse

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/api", tags=["market-data"])


@router.get("/market-prices", response_model=MarketMapResponse)
def get_market_prices_map(crop: str = Query("maize")) -> MarketMapResponse:
    return get_market_prices(crop=crop)
