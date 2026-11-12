"""Unit tests for OYSTER AI domain policies.

Run:  cd backend && python -m unittest discover -s tests -v
Pure stdlib — no framework needed for this layer.
"""
import unittest
from decimal import Decimal

from app.domain import (
    can_multiply,
    mask_destination,
    threshold,
    valid_destination,
)


class ThresholdTests(unittest.TestCase):
    def test_base_threshold_is_ten_dollars(self):
        self.assertEqual(threshold(1), Decimal("10"))

    def test_generation_progression(self):
        # Formula-based, not a hardcoded list
        self.assertEqual(threshold(2), Decimal("11"))
        self.assertEqual(threshold(3), Decimal("12"))
        self.assertEqual(threshold(4), Decimal("13"))
        self.assertEqual(threshold(5), Decimal("14"))

    def test_configurable_formula(self):
        base, inc = Decimal("5"), Decimal("2")
        self.assertEqual(threshold(1, base, inc), Decimal("5"))
        self.assertEqual(threshold(4, base, inc), Decimal("11"))

    def test_rejects_zero_generation(self):
        with self.assertRaises(ValueError):
            threshold(0)

    def test_rejects_negative_generation(self):
        with self.assertRaises(ValueError):
            threshold(-2)


class MultiplyEligibilityTests(unittest.TestCase):
    def test_eligible_at_exact_threshold(self):
        self.assertTrue(can_multiply(1, 10.00))

    def test_not_eligible_below_threshold(self):
        self.assertFalse(can_multiply(1, 9.99))

    def test_generation_two_requires_eleven(self):
        self.assertFalse(can_multiply(2, 10.00))
        self.assertTrue(can_multiply(2, 11.00))

    def test_safety_stop_blocks_multiplication(self):
        self.assertFalse(can_multiply(1, 100, stopped=True))

    def test_used_funds_never_reused(self):
        self.assertFalse(can_multiply(1, 100, already_used=True))

    def test_commitments_are_reserved(self):
        # $12 available, $3 committed -> $9 free, below $10 threshold
        self.assertFalse(can_multiply(1, 12, commitments=3))
        # $12 available, $2 committed -> $10 free, exactly at threshold
        self.assertTrue(can_multiply(1, 12, commitments=2))

    def test_negative_funds_rejected(self):
        self.assertFalse(can_multiply(1, -5))

    def test_string_amounts_accepted(self):
        # Ledger values may arrive as strings from the DB
        self.assertTrue(can_multiply(1, "10.00"))


class DestinationValidationTests(unittest.TestCase):
    def test_valid_crypto_address(self):
        self.assertTrue(valid_destination("crypto", "0x" + "a" * 40))
        self.assertTrue(valid_destination("crypto", "bc1q" + "x" * 38))

    def test_seed_phrase_rejected(self):
        # Seed phrases contain spaces — a public address never does
        self.assertFalse(valid_destination("crypto", "legal winner thank year wave sausage"))

    def test_too_short_crypto_rejected(self):
        self.assertFalse(valid_destination("crypto", "0x1234"))

    def test_bank_provider_references(self):
        self.assertTrue(valid_destination("bank", "ACCT-REF-982311"))
        self.assertTrue(valid_destination("provider", "provider_ref_7f3a2b"))
        self.assertFalse(valid_destination("bank", "short"))

    def test_unknown_kind_rejected(self):
        self.assertFalse(valid_destination("telegram_dm", "whatever"))


class MaskingTests(unittest.TestCase):
    def test_masks_full_destination(self):
        out = mask_destination("0x1234567890abcdef1234567890abcdef12345678")
        self.assertTrue(out.startswith("••••"))
        self.assertFalse("abcdef" in out)

    def test_short_value_fully_masked(self):
        self.assertEqual(mask_destination("abc"), "••••")


if __name__ == "__main__":
    unittest.main()