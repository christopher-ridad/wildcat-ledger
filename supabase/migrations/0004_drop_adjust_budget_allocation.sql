-- adjust_budget_allocation was superseded by apply_budget_delta
-- (0003_atomic_ledger_workflows.sql) and has had no callers since. Dropping it
-- also revokes the grant made in 0001_init.sql.

drop function if exists adjust_budget_allocation(uuid, text, numeric);
