
from typing import Any

from langchain_core.tools import tool

from models.common import truncate_sms
from models.loan import LoanRequest, LoanResponse, RiskVerdict

# Standard Central Bank of Kenya (CBK) benchmark interest rate as of June 2026
CBK_CBR_RATE = 8.75  # 8.75% per annum


def _assess_loan(
    principal: float,
    interest_rate: float,
    rate_period: str,
    term_value: float,
    term_unit: str,
    compounding_frequency: str = "monthly",
    is_simple_interest: bool = False,
) -> dict[str, Any]:
    """Core loan assessment — returns structured fields for API and agent tool."""
    principal = float(principal)
    interest_rate = float(interest_rate)
    term_value = float(term_value)
    rate_period = rate_period.strip().lower()
    term_unit = term_unit.strip().lower()
    compounding_frequency = compounding_frequency.strip().lower()

    if principal <= 0 or interest_rate < 0 or term_value <= 0:
        return {"error": "Principal, interest rate, and term must be positive numbers."}

    days_in_year = 365.25
    if term_unit == "years":
        term_years = term_value
    elif term_unit == "months":
        term_years = term_value / 12.0
    elif term_unit == "weeks":
        term_years = term_value / 52.14
    elif term_unit == "days":
        term_years = term_value / days_in_year
    else:
        return {"error": f"Invalid term_unit '{term_unit}'. Use 'years', 'months', 'weeks', or 'days'."}

    if rate_period == "annual":
        annual_stated_rate = interest_rate
    elif rate_period == "monthly":
        annual_stated_rate = interest_rate * 12
    elif rate_period == "weekly":
        annual_stated_rate = interest_rate * 52.14
    elif rate_period == "daily":
        annual_stated_rate = interest_rate * days_in_year
    else:
        return {"error": f"Invalid rate_period '{rate_period}'. Use 'annual', 'monthly', 'weekly', or 'daily'."}

    if compounding_frequency == "annually":
        compounding_periods_per_year = 1
    elif compounding_frequency == "monthly":
        compounding_periods_per_year = 12
    elif compounding_frequency == "weekly":
        compounding_periods_per_year = 52
    elif compounding_frequency == "daily":
        compounding_periods_per_year = 365
    else:
        compounding_periods_per_year = 12

    if is_simple_interest:
        total_repayment = principal * (1 + (annual_stated_rate / 100.0) * term_years)
        total_interest = total_repayment - principal
        real_apr = annual_stated_rate
    else:
        r_decimal = annual_stated_rate / 100.0
        n_total_periods = compounding_periods_per_year * term_years
        total_repayment = principal * ((1 + r_decimal / compounding_periods_per_year) ** n_total_periods)
        total_interest = total_repayment - principal
        real_apr = ((1 + r_decimal / compounding_periods_per_year) ** compounding_periods_per_year - 1) * 100

    interest_to_principal_ratio = total_interest / principal

    verdict = ""
    risk_level = ""
    advice = ""

    if real_apr <= 12.0:
        risk_level = "VERY SAFE (Excellent)"
        verdict = "SAFE TO TAKE"
        advice = (
            f"This loan's rate ({real_apr:.2f}% APR) is very close to the Central Bank of Kenya "
            f"CBR rate ({CBK_CBR_RATE}%). It is highly subsidized (like the Hustler Fund or government agricultural "
            f"cooperative loans). You are highly encouraged to proceed if you need the capital."
        )
    elif real_apr <= 19.0:
        risk_level = "SAFE (Fair)"
        verdict = "SAFE TO TAKE"
        advice = (
            f"This loan represents standard commercial bank rates in Kenya (currently averaging CBR + 6-10%). "
            f"It is a fair market rate for agricultural investment. Ensure your crop yield projections can cover the repayments."
        )
    elif real_apr <= 35.0:
        risk_level = "MODERATE RISK (Caution)"
        verdict = "TAKE WITH CAUTION"
        advice = (
            f"This rate ({real_apr:.2f}% APR) matches regulated Saccos or agricultural microfinance institutions. "
            f"It is slightly expensive. Only take this loan if you have a guaranteed buyer/market contract for your crops "
            f"to ensure you can pay it back on time."
        )
    elif real_apr <= 70.0:
        risk_level = "HIGH RISK"
        verdict = "DO NOT TAKE (Highly Unsafe)"
        advice = (
            f"WARNING: This represents standard digital app or mobile credit lending rates. "
            f"At {real_apr:.2f}% APR, the interest will eat heavily into your farming profits. "
            f"Look for cheaper funding sources like local agricultural cooperatives or Saccos instead."
        )
    else:
        risk_level = "DANGEROUS (Predatory)"
        verdict = "DO NOT TAKE (Dangerous)"
        advice = (
            f"CRITICAL WARNING: This is a predatory or extremely high-cost loan ({real_apr:.2f}% APR). "
            f"The compound interest structure makes it highly likely to trap you in a cycle of debt. "
            f"The total repayment is {total_repayment:,.2f} KES on a {principal:,.2f} KES loan (you are paying back "
            f"{interest_to_principal_ratio * 100:.1f}% of the loan amount in interest alone). Reject this loan immediately."
        )

    if interest_to_principal_ratio >= 0.50 and verdict == "SAFE TO TAKE":
        verdict = "TAKE WITH CAUTION"
        risk_level = "MODERATE RISK"
        advice = (
            f"Although the annual interest rate seems reasonable, the long repayment period means "
            f"you will end up paying KES {total_interest:,.2f} in interest, which is "
            f"{interest_to_principal_ratio * 100:.1f}% of the amount borrowed. Proceed only if absolutely necessary."
        )

    return {
        "principal": principal,
        "interest_rate": interest_rate,
        "rate_period": rate_period,
        "term_value": term_value,
        "term_unit": term_unit,
        "compounding_frequency": compounding_frequency,
        "is_simple_interest": is_simple_interest,
        "real_apr": round(real_apr, 2),
        "cbk_rate": CBK_CBR_RATE,
        "total_repayment": total_repayment,
        "total_interest": total_interest,
        "interest_to_principal_ratio": interest_to_principal_ratio,
        "verdict": verdict,
        "risk_level": risk_level,
        "advice": advice,
    }


def evaluate_monthly_rate(monthly_rate_percent: float) -> dict[str, Any]:
    """
    SMS/API entry point: farmer quotes a monthly rate (e.g. LOAN 10 → 10%/month).
    Uses a standard 12-month term for APR comparison — matches sprint demo case.
    """
    return _assess_loan(
        principal=50_000,
        interest_rate=monthly_rate_percent,
        rate_period="monthly",
        term_value=12,
        term_unit="months",
        compounding_frequency="monthly",
        is_simple_interest=False,
    )


def _format_loan_report(result: dict[str, Any]) -> str:
    if "error" in result:
        return f"Error: {result['error']}"

    return (
        f"=== SokoSense Loan Audit Report ===\n"
        f"• Principal Amount: KES {result['principal']:,.2f}\n"
        f"• Stated Rate: {result['interest_rate']}% per {result['rate_period']}\n"
        f"• Loan Term: {result['term_value']} {result['term_unit']}\n"
        f"• Interest Type: {'Simple' if result['is_simple_interest'] else 'Compound (' + result['compounding_frequency'] + ')'}\n"
        f"------------------------------------\n"
        f"• Calculated Real APR: {result['real_apr']:.2f}%\n"
        f"• CBK Benchmark Rate (CBR): {result['cbk_rate']}%\n"
        f"• Total Repayment Amount: KES {result['total_repayment']:,.2f}\n"
        f"• Total Interest Cost: KES {result['total_interest']:,.2f}\n"
        f"• Interest-to-Principal: {result['interest_to_principal_ratio'] * 100:.1f}%\n"
        f"------------------------------------\n"
        f"VERDICT: {result['verdict']}\n"
        f"RISK LEVEL: {result['risk_level']}\n\n"
        f"ADVICE:\n{result['advice']}"
    )


@tool
def advise_on_loan(
    principal: float,
    interest_rate: float,
    rate_period: str,
    term_value: float,
    term_unit: str,
    compounding_frequency: str = "monthly",
    is_simple_interest: bool = False,
) -> str:
    """
    Analyzes a potential loan for a farmer, calculates the repayment details,
    determines the real APR (Annual Percentage Rate), benchmarks it against the
    Central Bank of Kenya (CBK) rate (8.75%), and gives a safety verdict.

    Args:
        principal: The principal loan amount in KES (e.g. 50000).
        interest_rate: The stated interest rate as a percentage (e.g. 5 for 5%, 0.5 for 0.5%).
        rate_period: The period of the interest rate. Must be one of: 'annual', 'monthly', 'weekly', 'daily'.
        term_value: The duration/term of the loan (e.g. 12).
        term_unit: The unit of the term. Must be one of: 'years', 'months', 'weeks', 'days'.
        compounding_frequency: How often interest compounds. Must be one of: 'annually', 'monthly', 'weekly', 'daily'.
        is_simple_interest: Set to True to calculate using simple interest instead of compound interest.
    """
    try:
        result = _assess_loan(
            principal=principal,
            interest_rate=interest_rate,
            rate_period=rate_period,
            term_value=term_value,
            term_unit=term_unit,
            compounding_frequency=compounding_frequency,
            is_simple_interest=is_simple_interest,
        )
        if "error" in result:
            return result["error"]
        return _format_loan_report(result)
    except Exception as e:
        return f"An error occurred while calculating loan advice: {str(e)}"


def _map_risk_verdict(verdict: str, risk_level: str) -> RiskVerdict:
    v = verdict.upper()
    r = risk_level.upper()
    if "DANGEROUS" in r or "PREDATORY" in r:
        return RiskVerdict.AVOID
    if "DO NOT TAKE" in v and "HIGHLY" in v:
        return RiskVerdict.HIGH_RISK
    if "DO NOT TAKE" in v:
        return RiskVerdict.AVOID
    if "MODERATE" in r or "CAUTION" in v:
        return RiskVerdict.CAUTION
    return RiskVerdict.SAFE


def _build_short_reply(monthly: float, apr: float, mapped: RiskVerdict) -> str:
    ratio = round(apr / CBK_CBR_RATE, 1) if CBK_CBR_RATE else 0
    if mapped == RiskVerdict.AVOID:
        return truncate_sms(
            f"DO NOT TAKE THIS LOAN. {apr}% APR. {ratio}x the CBK rate. Try your SACCO."
        )
    if mapped == RiskVerdict.HIGH_RISK:
        return truncate_sms(
            f"HIGH RISK. {apr}% APR. {ratio}x CBK rate. Negotiate or use SACCO."
        )
    if mapped == RiskVerdict.CAUTION:
        return truncate_sms(
            f"CAUTION. {apr}% APR. Above CBK benchmark. Compare SACCO options first."
        )
    return truncate_sms(
        f"SAFE. {apr}% APR. Near CBK benchmark. Still read all loan terms."
    )


def decide_loan(request: LoanRequest) -> LoanResponse:
    """Map loan assessment to FastAPI contract."""
    monthly = request.monthly_rate_percent
    result = evaluate_monthly_rate(monthly)

    if "error" in result:
        return LoanResponse(
            monthly_rate_percent=monthly,
            apr_percent=0.0,
            cbk_rate_percent=CBK_CBR_RATE,
            risk_verdict=RiskVerdict.AVOID,
            short_reply=truncate_sms(f"Invalid loan input: {result['error']}"),
            comparison_phrase=truncate_sms(result["error"]),
            payment_id=None,
        )

    apr = result["real_apr"]
    mapped = _map_risk_verdict(result["verdict"], result["risk_level"])
    short_reply = _build_short_reply(monthly, apr, mapped)
    comparison = truncate_sms(
        f"{monthly}%/month = {apr}% APR vs CBK CBR {CBK_CBR_RATE}% p.a."
    )

    return LoanResponse(
        monthly_rate_percent=monthly,
        apr_percent=apr,
        cbk_rate_percent=CBK_CBR_RATE,
        risk_verdict=mapped,
        short_reply=short_reply,
        comparison_phrase=comparison,
        payment_id=None,
    )
