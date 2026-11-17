# Cross-Layer Entity Specification & Mapping Guide

Every persistent or externally exposed domain concept MUST have an entry `## ENT-<Name>` in `docs/specs/specs/03-domain-and-entity-map.md` and detailed layer schemas in `external-communication/`, `backend/`, and `persistence/`.

## Three-Layer Separation Rule

Raw database rows MUST NEVER be returned directly as API responses, and raw HTTP request bodies MUST NEVER be passed directly into persistence repositories.

1. **API Request / Response DTOs (`docs/specs/external-communication/`):**
   - Wire-level JSON shapes (`Create<Name>RequestDto`, `Update<Name>RequestDto`, `<Name>ResponseDto`), validated at the boundary (e.g., Zod / TypeBox / Pydantic).
   - Uses wire conventions (ISO-8601 UTC strings, public prefixed IDs, never internal password hashes or secret columns).
2. **Application Business Entity (`docs/specs/backend/`):**
   - Domain-rich immutable/validated model (`<Name>Entity` / domain value objects) holding business invariants and state transition rules.
3. **Database Entity (`docs/specs/persistence/`):**
   - Exact storage row (`<Name>Row`), column types (`uuid`/`text`, `timestamptz`, `numeric`, `jsonb`), constraints, and indexes.

## Required Template in `docs/specs/specs/03-domain-and-entity-map.md`

```markdown
## ENT-Order

- **Summary:** Customer purchase order lifecycle from draft to fulfillment.
- **API DTOs:** `CreateOrderRequestDto`, `OrderResponseDto` (`docs/specs/external-communication/01-orders-api.md`)
- **Business Entity:** `Order` (`docs/specs/backend/01-orders-domain.md`)
- **Database Entity:** `orders` table / `OrderRow` (`docs/specs/persistence/01-orders-schema.md`)
- **Mappers:** `mapCreateOrderDtoToCommand`, `mapOrderToResponseDto`, `mapOrderRowToEntity`, `mapOrderEntityToRow`

| Concept / Field | API Req/Res DTO | Business Entity | Database Entity (`orders`) | Transformation & Invariant Rules |
|---|---|---|---|---|
| Identifier | `id: string` (`ord_...`) | `id: OrderId` | `id text PK` | Prefixed ULID; omitted on `CreateOrderRequestDto` |
| Customer | `customer_id: string` | `customerId: CustomerId` | `customer_id text FK NOT NULL` | Must reference active customer |
| Total Amount | `total_cents: number` (res only) | `total: Money` | `total_cents bigint NOT NULL` | Computed from line items; >= 0 |
| Status | `status: "draft" \| "paid"` | `status: OrderStatus` | `status text CHECK (...)` | Transitions guarded by `Order.transition()` |
| Created Timestamp | `created_at: string` (ISO UTC) | `createdAt: Instant` | `created_at timestamptz NOT NULL` | `Date`/`Instant` <-> ISO-8601 string |
```
