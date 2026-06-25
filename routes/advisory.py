"""Advisory RAG route — farmer questions + weather + crop knowledge."""

from fastapi import APIRouter

from engines.advisory import answer_farmer_question
from models.advisory import AdvisoryRequest, AdvisoryResponse

router = APIRouter(prefix="/api", tags=["advisory"])


@router.post("/advisory", response_model=AdvisoryResponse)
def post_advisory(body: AdvisoryRequest) -> AdvisoryResponse:
    """Answer a farmer's question using the RAG pipeline.

    Extracts crop, disease, and location from the query, retrieves
    knowledge from Neo4j, fetches weather data, and calls the LLM.
    """
    result = answer_farmer_question(body.query, include_weather=True)
    return AdvisoryResponse(
        query=result["query"],
        answer=result["answer"],
        location=result["location"],
        weather=result.get("weather"),
        sources=result.get("sources", []),
    )
