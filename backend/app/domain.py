"""OYSTER AI — domain policies.

Pure, deterministic, provider-independent business rules.
No I/O, no external calls — every function here is unit-testable.
"""
from decimal import Decimal, InvalidOperation

# Configurable multiplication policy (defaults; can be overridden per call)
BASE_THRESHOLD = Decimal("10")   # Generation 1 requires $10
INCREMENT = Decimal("1")         # Each next generation costs $1 more


def threshold(generation: int, base: Decimal = BASE_THRESHOLD, increment: Decimal = INCREMENT) -> Decimal:
    """Multiplication threshold for a generation.

    threshold(g) = base + increment * (g - 1)

    Gen 1 -> $10, Gen 2 -> $11, Gen 3 -> $12 ... (configurable formula,
    never a hardcoded list.)
    """
    if generation < 1:
        raise ValueError("generation must be >= 1")
    if base < 0 or increment < 0:
        raise ValueError("threshold parameters must be non-negative")
    return base + increment * (generation - 1)


def can_multiply(
    generation: int,
    verified_net: Decimal | float | str,
    commitments: Decimal | float | str = 0,
    already_used: bool = False,
    stopped: bool = False,
) -> bool:
    """Eligibility gate for creating a child instance.

    Rules enforced:
      - Emergency safety stop blocks all multiplication.
      - Funds already used for a previous child can never be reused.
      - Only VERIFIED net funds (revenue already reconciled) count.
      - Committed funds are reserved and never spent on new instances.
    """
    if stopped or already_used:
        return False
    net = _dec(verified_net)
    reserved = _dec(commitments)
    if net < 0 or reserved < 0:
        return False
    return net - reserved >= threshold(generation)


def valid_destination(kind: str, value: str) -> bool:
    """Structural validation of a payout destination reference.

    This is a *reference* to a public destination, never a credential.
    We reject anything that looks like a seed phrase or contains spaces
    for crypto kind.
    """
    v = (value or "").strip()
    if kind == "crypto":
        if len(v) < 20 or len(v) > 128:
            return False
        if any(ch.isspace() for ch in v):
            return False  # seed phrases have spaces; addresses don't
        return True
    if kind in ("bank", "provider"):
        return 8 <= len(v) <= 180
    return False


def mask_destination(value: str) -> str:
    """Display-safe masking: never show a full destination in the UI."""
    v = (value or "").strip()
    if len(v) <= 5:
        return "••••"
    return "••••" + v[-5:]


def _dec(value) -> Decimal:
    try:
        d = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("invalid numeric value") from exc
    if not d.is_finite():
        raise ValueError("numeric value must be finite")
    return d