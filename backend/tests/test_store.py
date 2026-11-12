"""Store-layer tests using an isolated temp database.

Validates schema creation, settings, activity logging, and the safety flag.
"""
import os
import tempfile
import unittest

# Isolate the DB before importing store (module reads DATABASE_PATH at import)
_tmpdir = tempfile.TemporaryDirectory()
os.environ["DATABASE_PATH"] = os.path.join(_tmpdir.name, "test.sqlite3")

from app.store import connect, get_setting, init_db, is_stopped, log, set_setting  # noqa: E402


class StoreTests(unittest.TestCase):
    def setUp(self):
        init_db()

    def test_settings_roundtrip(self):
        with connect() as c:
            set_setting(c, "owner_name", "Test Owner")
            self.assertEqual(get_setting(c, "owner_name"), "Test Owner")
            # overwrite
            set_setting(c, "owner_name", "Renamed")
            self.assertEqual(get_setting(c, "owner_name"), "Renamed")

    def test_missing_setting_returns_empty(self):
        with connect() as c:
            self.assertEqual(get_setting(c, "nope"), "")

    def test_activity_log_appends(self):
        with connect() as c:
            log(c, "First event", status="info")
            log(c, "Second event", status="success")
            rows = c.execute("SELECT * FROM activity ORDER BY id").fetchall()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["event"], "First event")

    def test_safety_flag_defaults_off(self):
        with connect() as c:
            self.assertFalse(is_stopped(c))
            c.execute("UPDATE safety SET stopped=1 WHERE id=1")
            self.assertTrue(is_stopped(c))

    def test_transactions_constraint_rejects_negative(self):
        with connect() as c:
            with self.assertRaises(Exception):
                c.execute(
                    "INSERT INTO transactions(id, type, amount_cents, status) "
                    "VALUES ('t1','revenue',-5,'verified')"
                )

    def test_instance_generation_check_constraint(self):
        with connect() as c:
            with self.assertRaises(Exception):
                c.execute(
                    "INSERT INTO instances(id, generation, name, status, threshold_cents) "
                    "VALUES ('x1', 0, 'Bad', 'active', 1000)"
                )

    def test_transaction_external_ref_unique(self):
        with connect() as c:
            c.execute(
                "INSERT INTO transactions(id, type, amount_cents, status, external_ref) "
                "VALUES ('t1','revenue',100,'verified','ext-1')"
            )
            with self.assertRaises(Exception):
                c.execute(
                    "INSERT INTO transactions(id, type, amount_cents, status, external_ref) "
                    "VALUES ('t2','revenue',100,'verified','ext-1')"
                )


if __name__ == "__main__":
    unittest.main()