import re

FORBIDDEN_CREDENTIAL_PATTERNS = [
    r'\bpin\b', r'\botp\b', r'\bpassword\b', r'\bcard number\b',
    r'\bshare your\b', r'\bprovide your\b', r'\benter your\b',
    r'\bsend your\b', r'\bverify with your\b', r'\bconfirm your pin\b'
]

FORBIDDEN_CONFIRMATION_PATTERNS = [
    r'\bwe will refund\b', r'\byour refund will be\b',
    r'\bwe will reverse\b', r'\bwe will unblock\b',
    r'\bguarantee\b', r'\bwe promise\b', r'\byou will receive\b',
    r'\brefund has been approved\b', r'\bwe will credit\b'
]

SAFE_REFUND_LANGUAGE = "Any eligible amount will be returned through official channels after verification."

def check_for_violations(text: str) -> list:
    text_lower = text.lower()
    violations = []

    for pattern in FORBIDDEN_CREDENTIAL_PATTERNS:
        if re.search(pattern, text_lower):
            violations.append(f"credential_request: {pattern}")

    for pattern in FORBIDDEN_CONFIRMATION_PATTERNS:
        if re.search(pattern, text_lower):
            violations.append(f"unauthorized_confirmation: {pattern}")

    return violations

def apply_safety_rules(result: dict) -> dict:
    customer_reply = result.get("customer_reply", "")
    next_action = result.get("recommended_next_action", "")

    # Check and fix customer_reply
    cred_violations = []
    for pattern in FORBIDDEN_CREDENTIAL_PATTERNS:
        if re.search(pattern, customer_reply.lower()):
            cred_violations.append(pattern)

    if cred_violations:
        result["customer_reply"] = (
            "Thank you for reaching out. We have received your complaint and our team is reviewing it. "
            "Please do not share your PIN, OTP, or password with anyone. "
            "We will contact you through official channels once the review is complete."
        )
        result["reason_codes"] = result.get("reason_codes", []) + ["safety_reply_overridden"]

    # Check and fix unauthorized confirmations
    for pattern in FORBIDDEN_CONFIRMATION_PATTERNS:
        if re.search(pattern, customer_reply.lower()):
            result["customer_reply"] = result["customer_reply"].replace(
                re.search(pattern, customer_reply.lower()).group(),
                SAFE_REFUND_LANGUAGE
            )
            result["reason_codes"] = result.get("reason_codes", []) + ["refund_language_corrected"]

    # Force human review for risky cases
    risky_types = ["wrong_transfer", "phishing_or_social_engineering", "duplicate_payment"]
    if result.get("case_type") in risky_types:
        result["human_review_required"] = True

    if result.get("severity") in ["high", "critical"]:
        result["human_review_required"] = True

    if result.get("evidence_verdict") == "inconsistent":
        result["human_review_required"] = True

    return result