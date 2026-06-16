

from typing import Dict, Any, Optional
from langchain_core.tools import tool

# Standard Central Bank of Kenya (CBK) benchmark interest rate as of June 2026
CBK_CBR_RATE = 8.75  # 8.75% per annum

@tool
def advise_on_loan(
    principal: float,
    interest_rate: float,
    rate_period: str,
    term_value: float,
    term_unit: str,
    compounding_frequency: str = "monthly",
    is_simple_interest: bool = False
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
        # 1. Standardize Inputs
        principal = float(principal)
        interest_rate = float(interest_rate)
        term_value = float(term_value)
        rate_period = rate_period.strip().lower()
        term_unit = term_unit.strip().lower()
        compounding_frequency = compounding_frequency.strip().lower()

        if principal <= 0 or interest_rate < 0 or term_value <= 0:
            return "Error: Principal, interest rate, and term must be positive numbers."

        # 2. Convert term to years for APR calculations
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
            return f"Error: Invalid term_unit '{term_unit}'. Use 'years', 'months', 'weeks', or 'days'."

        # 3. Calculate Stated Annual Rate (SAR) and APR
        # Normalize stated rate to annual base
        if rate_period == "annual":
            annual_stated_rate = interest_rate
        elif rate_period == "monthly":
            annual_stated_rate = interest_rate * 12
        elif rate_period == "weekly":
            annual_stated_rate = interest_rate * 52.14
        elif rate_period == "daily":
            annual_stated_rate = interest_rate * days_in_year
        else:
            return f"Error: Invalid rate_period '{rate_period}'. Use 'annual', 'monthly', 'weekly', or 'daily'."

        # Determine compounding periods per year (m)
        if compounding_frequency == "annually":
            compounding_periods_per_year = 1
        elif compounding_frequency == "monthly":
            compounding_periods_per_year = 12
        elif compounding_frequency == "weekly":
            compounding_periods_per_year = 52
        elif compounding_frequency == "daily":
            compounding_periods_per_year = 365
        else:
            compounding_periods_per_year = 12  # Default to monthly

        # Calculate Total Repayment and Real APR
        if is_simple_interest:
            # Simple Interest Formula: A = P(1 + r*t)
            # r = annual interest rate, t = term in years
            total_repayment = principal * (1 + (annual_stated_rate / 100.0) * term_years)
            total_interest = total_repayment - principal
            real_apr = annual_stated_rate  # For simple interest, APR is equivalent to the annual rate
        else:
            # Compound Interest Formula: A = P(1 + r/m)^(m*t)
            # r = annual stated rate, m = compounding periods/year, t = term in years
            r_decimal = annual_stated_rate / 100.0
            n_total_periods = compounding_periods_per_year * term_years
            total_repayment = principal * ((1 + r_decimal / compounding_periods_per_year) ** n_total_periods)
            total_interest = total_repayment - principal
            
            # Calculate Effective Annual Rate (EAR) / Real APR
            # APR = ((1 + r/m)^m - 1) * 100
            real_apr = ((1 + r_decimal / compounding_periods_per_year) ** compounding_periods_per_year - 1) * 100

        interest_to_principal_ratio = total_interest / principal

        # 4. Benchmarking and Risk Assessment
        # CBK Base Lending Rate is 8.75%
        # Standard commercial banks charge CBR + (~5-10%) => up to ~18% APR
        # Saccos/Microfinance charge up to ~35% APR
        # Regulated Mobile lenders charge up to ~70% APR
        # Dangerous shark lenders/unregulated apps go over 70% APR
        
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
            # real_apr > 70% OR total_repayment is huge
            risk_level = "DANGEROUS (Predatory)"
            verdict = "DO NOT TAKE (Dangerous)"
            advice = (
                f"CRITICAL WARNING: This is a predatory or extremely high-cost loan ({real_apr:.2f}% APR). "
                f"The compound interest structure makes it highly likely to trap you in a cycle of debt. "
                f"The total repayment is {total_repayment:,.2f} KES on a {principal:,.2f} KES loan (you are paying back "
                f"{interest_to_principal_ratio * 100:.1f}% of the loan amount in interest alone). Reject this loan immediately."
            )

        # Additional condition: check if total repayment is exponentially large
        if interest_to_principal_ratio >= 0.50 and verdict == "SAFE TO TAKE":
            # Demote verdict if interest is more than half the principal due to long loan periods
            verdict = "TAKE WITH CAUTION"
            risk_level = "MODERATE RISK"
            advice = (
                f"Although the annual interest rate seems reasonable, the long repayment period means "
                f"you will end up paying KES {total_interest:,.2f} in interest, which is "
                f"{interest_to_principal_ratio * 100:.1f}% of the amount borrowed. Proceed only if absolutely necessary."
            )

        # 5. Build Report String
        report = (
            f"=== SokoSense Loan Audit Report ===\n"
            f"• Principal Amount: KES {principal:,.2f}\n"
            f"• Stated Rate: {interest_rate}% per {rate_period}\n"
            f"• Loan Term: {term_value} {term_unit}\n"
            f"• Interest Type: {'Simple' if is_simple_interest else 'Compound (' + compounding_frequency + ')'}\n"
            f"------------------------------------\n"
            f"• Calculated Real APR: {real_apr:.2f}%\n"
            f"• CBK Benchmark Rate (CBR): {CBK_CBR_RATE}%\n"
            f"• Total Repayment Amount: KES {total_repayment:,.2f}\n"
            f"• Total Interest Cost: KES {total_interest:,.2f}\n"
            f"• Interest-to-Principal: {interest_to_principal_ratio * 100:.1f}%\n"
            f"------------------------------------\n"
            f"📢 VERDICT: {verdict}\n"
            f"⚠️ RISK LEVEL: {risk_level}\n\n"
            f"💡 ADVICE:\n{advice}"
        )
        return report

    except Exception as e:
        return f"An error occurred while calculating loan advice: {str(e)}"
