# supabase-rls
Query: Supabase row level security auth uid security definer composite foreign key tenant isolation
Retrieved: 2026-09-19T01:53:55.978993+00:00

## https://tessl.io/registry/testland/rls-reference
ID: doc:https://tessl.io/registry/testland/rls-reference
## testland/rls-reference
Pure-reference catalog of row-level security for tenant isolation, Postgres-first. ENABLE ROW LEVEL SECURITY, default-deny semantics), CREATE POLICY syntax (USING vs WITH CHECK clauses, FOR SELECT/INSERT/UPDATE/DELETE/ALL, permissive vs restrictive, TO role_name), bypassing RLS (superuser / BYPASSRLS / table owner / FORCE ROW LEVEL SECURITY), tenant context patterns (current_user, current_setting, JWT claims via Supabase auth.uid() / auth.jwt()), and performance discipline (wrapping auth functions in SELECT, index on policy-referenced columns). Row/tenant isolation on the non-Postgres engines - MySQL / MariaDB invoker views, CockroachDB native RLS, Vitess vindex sharding, SQL Server security policies - lives in references/other-engines.md. Use as the RLS-pattern reference for tenant isolation on any of these engines. Consumed by cross-tenant-data-leak-tests.

1.0.0 (Latest)

75

Quality

94%

Run evals on this skill

View guide

SecuritybySnyk

Passed

No findings from the security scan

name:rls-reference

description:Pure-reference catalog of row-level security for tenant isolation, Postgres-first. ENABLE ROW LEVEL SECURITY, default-deny semantics), CREATE POLICY syntax (USING vs WITH CHECK clauses, FOR SELECT/INSERT/UPDATE/DELETE/ALL, permissive vs restrictive, TO role_name), bypassing RLS (superuser / BYPASSRLS / table owner / FORCE ROW LEVEL SECURITY), tenant context patterns (current_user, current_setting, JWT claims via Supabase auth.uid() / auth.jwt()), and performance discipline (wrapping auth functions in SELECT, index on policy-referenced columns). Row/tenant isolation on the non-Postgres engines - MySQL / MariaDB invoker views, CockroachDB native RLS, Vitess vindex sharding, SQL Server security policies - lives in references/other-engines.md. Use as the RLS-pattern reference for tenant isolation on any of these engines. Consumed by cross-tenant-data-leak-tests.

# rls-reference
## Overview
Per postgresql.org/docs/current/ddl-rowsecurity.html, Unlike

reviewers. references/other-engines.md. For the broader

## Performance discipline

## Anti-patterns
| Anti-pattern | Why it fails | Fix |
|-|-|-|
| `auth.uid()` not wrapped in SELECT | Per-row evaluation - major perf hit at scale | `(SELECT auth.uid())` for initPlan caching |
… (4 more lines)

## https://tessl.io/registry/testland/row-level-security-postgres-reference
ID: doc:https://tessl.io/registry/testland/row-level-security-postgres-reference
## testland/row-level-security-postgres-reference
Pure-reference catalog of Postgres Row-Level Security (RLS) for tenant isolation. ENABLE ROW LEVEL SECURITY, default-deny semantics), CREATE POLICY syntax (USING vs WITH CHECK clauses, FOR SELECT/INSERT/UPDATE/DELETE/ALL, permissive vs restrictive, TO role_name), bypassing RLS (superuser / BYPASSRLS / table owner / FORCE ROW LEVEL SECURITY), tenant context patterns (current_user, current_setting, JWT claims via Supabase auth.uid() / auth.jwt()), performance discipline (wrapping auth functions in SELECT, index on policy-referenced columns), and anti-patterns. Use as the RLS-pattern reference for Postgres-backed tenant isolation. Consumed by tenant-leak-test-author, cross-tenant-data-leak-tests.

1.3.3 (Latest)1.3.20.1.0

75

Quality

94%

Run evals on this skill

View guide

SecuritybySnyk

Passed

name:row-level-security-postgres-reference

description:Pure-reference catalog of Postgres Row-Level Security (RLS) for tenant isolation. ENABLE ROW LEVEL SECURITY, default-deny semantics), CREATE POLICY syntax (USING vs WITH CHECK clauses, FOR SELECT/INSERT/UPDATE/DELETE/ALL, permissive vs restrictive, TO role_name), bypassing RLS (superuser / BYPASSRLS / table owner / FORCE ROW LEVEL SECURITY), tenant context patterns (current_user, current_setting, JWT claims via Supabase auth.uid() / auth.jwt()), performance discipline (wrapping auth functions in SELECT, index on policy-referenced columns), and anti-patterns. Use as the RLS-pattern reference for Postgres-backed tenant isolation. Consumed by tenant-leak-test-author, cross-tenant-data-leak-tests.

# row-level-security-postgres-reference
## When to use
- Designing tenant isolation on a Postgres-backed pool / bridge model.

## Tenant context patterns
Supabase `auth.uid()` / `auth.jwt()`, and in-policy JWT claim parsing:

## Performance discipline

## Anti-patterns
| Anti-pattern | Why it fails | Fix |
|-|-|-|
| `auth.uid()` not wrapped in SELECT | Per-row evaluation - major perf hit at scale | `(SELECT auth.uid())` for initPlan caching |

## Worked example

Setting The table is isolated for both reads and writes.

## Enabling RLS

```
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
```

Per Postgres docs: "Once enabled, a default-deny policy applies - no rows are
visible or modifiable unless explicitly allowed by a policy."

To disable:

```
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
```

### Force RLS on table owner

By default, the **table owner bypasses RLS**. For tenant isolation this is
dangerous - the application's connecting role is often the table owner. Force
the owner to obey policies too:

```
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
```

Per Postgres docs, this is the production-safe default for multi-tenant tables.

## CREATE POLICY syntax

The full grammar plus `USING` vs `WITH CHECK`, per-command policies, permissive
vs restrictive combination, and `TO role_name` scoping:
references/create-policy-syntax.md.

## Tenant context patterns

The policy needs a source of truth for the current tenant. Four canonical
patterns - `current_setting()` with `SET LOCAL`, `current_user` / `session_user`,
Supabase `auth.uid()` / `auth.jwt()`, and in-policy JWT claim parsing:
references/tenant-context-patterns.md.
… (31 more lines)

## https://github.com/microscaler/brrtrouter/blob/68a972a65d3e3f56198a72ad1fd4548e32f318dc/docs/SPIFFY_mTLS/03_Database-Level%20Authorization%20with%20Supabase_%20RLS%20and%20Multi-Tenant%20Security-Part3.md
ID: doc:https://github.com/microscaler/brrtrouter/blob/68a972a65d3e3f56198a72ad1fd4548e32f318dc/docs/SPIFFY_mTLS/03_Database-Level%20Authorization%20with%20Supabase_%20RLS%20and%20Multi-Tenant%20Security-Part3.md
**Database-Level Authorization with Supabase: RLS and Multi-Tenant Security**

This means that inside any SQL policy or function, we can call functions like  auth.uid() to get the user’s ID from the JWT and  auth.role() or  auth.jwt() to get other claims, directly within the database 13

**Hosted vs.** Either way, the trust relationship is the same: Supabase Auth is the issuer of tokens, and Postgres is the consumer that enforces them.

authenticated for logged-in users, and  anon for others) 16 .

in users). The JWT’s “role” claim usually is set to “authenticated” for normal users – the Supabase client library will use the anon key for public requests and switch to the user’s token for authenticated requests, automatically assuming the proper role on the Postgres side 17 .

profiles.user_id  foreign key to  auth.users ).

In summary, Supabase’s auth architecture provides a **secure identity layer tightly coupled with Postgres**.

PostgreSQL’s Row Level Security (RLS) is the cornerstone of our defense-in-depth strategy.

UPDATE, or  DELETE .

user.

CREATE POLICY "Tenant isolation on Orders"

ON orders FOR SELECT TO authenticated

If a user somehow tries to query another tenant’s ID, the condition fails and they get an empty result.

_in the set of tenant_ids for which this user is a member.”_

USING (

project.tenant_id IN (

AND m.user_id = auth.uid()

)
… (72 more lines)

Alternatively, you can create *limited* service accounts that still obey RLS but have their own policies. One approach is to create additional Postgres roles, say  worker\_role , and issue JWTs with  "role": "worker\_role" for certain server processes. Then you can write policies  TO worker\_role on tables that grant it broader read access than a normal user, but perhaps still not everything. For instance, you

might allow  worker\_role to read multiple tenants’ data for an analytic job, but *only specific columns* (you could combine RLS with Postgres **column-level security**  or selective grants in such cases). Designing service account access often means balancing convenience (sometimes it’s easier to just bypass RLS) with

the principle of least privilege. For PCI-DSS compliance, for example, you would want even internal services to have access only to the minimum data necessary – which might mean writing special RLS policies or using separate schemas for highly sensitive info.

**Concrete SQL Example – Putting it Together:** Let’s illustrate a realistic combination of policies on a single table. Consider an  Invoices table that has  tenant\_id ,  customer\_id ,  amount , etc. We want: (a) normal users can  SELECT only invoices from their tenant, (b) within a tenant, only users with role “finance”

or “admin” can see invoice details, (c) an admin can  UPDATE invoices (perhaps to correct data) but others cannot. We might achieve this with policies:

ALTER TABLE invoices ENABLE ROWLEVEL SECURITY;

-- Base tenant isolation for selects (any authenticated user of tenant can see basic info)

CREATE POLICY "Tenant iso for invoices"

ON invoices FOR SELECT TO authenticated

USING ( invoices.tenant\_id = (auth.jwt() ->> 'tenant\_id')::uuid );

-- Finance role can see details (perhaps a separate policy or using column-level SELECT privileges)

-- Admins can update invoices

CREATE POLICY "Tenant admins can update invoices"

ON invoices FOR UPDATE TO authenticated

USING (

invoices.tenant\_id = (auth.jwt() ->> 'tenant\_id')::uuid AND (auth.jwt() ->> 'role') = 'admin'

)

WITH CHECK (

invoices.tenant\_id = (auth.jwt() ->> 'tenant\_id')::uuid );

Here we assumed the JWT has a  'role' claim for simplicity. A more normalized approach would be to join to a roles table as shown earlier. But the key point is that multiple conditions can be combined. The first policy restricts read access by tenant. The second (update policy) further requires the user’s role be admin – this is an example of enforcing an *application-level rule (only admins can edit)* at the DB level too. If a non- admin somehow calls an update endpoint, the database will reject the update because the RLS  USING expression returns false for them. The  WITH CHECK  here ensures they can’t maliciously change the tenant\_id of an invoice to another value (though our  USING already prevents selecting cross-tenant, it’s a good practice to mirror tenant check in with-check on updates).
… (18 more lines)
