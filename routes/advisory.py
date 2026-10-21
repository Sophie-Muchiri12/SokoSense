"""Advisory RAG route — farmer questions + weather + crop knowledge."""

from fastapi import APIRouter, Depends

from auth.security import get_current_user

from engines.advisory import answer_farmer_question
from models.advisory import AdvisoryRequest, AdvisoryResponse

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/api", tags=["advisory"])


@router.post("/advisory", response_model=AdvisoryResponse)
def post_advisory(body: AdvisoryRequest) -> AdvisoryResponse:
    """Answer a farmer's question using the RAG pipeline.

    Extracts crop, disease, and location from the query, retrieves
    knowledge from Postgres (pgvector RAG), fetches weather data, and calls the LLM.
    """
    result = answer_farmer_question(body.query, include_weather=True)
    return AdvisoryResponse(
        query=result["query"],
        answer=result["answer"],
        location=result["location"],
        weather=result.get("weather"),
        market=result.get("market"),
        sources=result.get("sources", []),
    )
