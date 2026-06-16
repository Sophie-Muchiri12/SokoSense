from pydantic import BaseModel


class MarketPricePoint(BaseModel):
    name: str
    lat: float
    lng: float
    price_kes: float
    recommended: bool = False


class MarketMapResponse(BaseModel):
    crop: str
    date: str
    markets: list[MarketPricePoint]
