# Final RBAC Restructuring Plan

## Role Hierarchy

```
Admin
 ├── Operations Manager
 │     ├── Seller Employee
 │     └── Delivery Driver
 ├── Warehouse Manager
 │     └── Warehouse Staff
 └── Customer Support Manager
       └── Support Agent

Customer (external)
```

**9 roles total:** `admin`, `operations_manager`, `warehouse_manager`, `support_manager`, `seller`, `warehouse_staff`, `driver`, `support_agent`, `customer`

---

## Full Permission Matrix

| Feature | admin | ops_mgr | wh_mgr | sup_mgr | seller | wh_staff | driver | sup_agent | customer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create/delete managers | ✅ | | | | | | | | |
| Create/delete employees | ✅ | | | | | | | | |
| Assign roles | ✅ | | | | | | | | |
| System settings | ✅ | | | | | | | | |
| Full analytics | ✅ | | | | | | | | |
| Activity logs | ✅ | | | | | | | | |
| Product CRUD | ✅¹ | | | | ✅ | | | | |
| Category CRUD | ✅¹ | | | | ✅ | | | | |
| Discount management | ✅¹ | | | | ✅ | | | | |
| View all orders | ✅¹ | ✅ | 👁️² | | 👁️³ | | | | |
| Update order status | ✅¹ | ✅ | | | ✅⁴ | ✅⁵ | | | |
| Assign drivers | ✅¹ | ✅ | | | | | | | |
| View all deliveries | ✅¹ | ✅ | | | | | | | |
| Review delivery photos | ✅¹ | ✅ | | | | | | | |
| Resolve driver issues | ✅¹ | ✅ | | | | | | | |
| Track drivers (map) | ✅¹ | ✅ | | | | | | | |
| Monitor stock levels | ✅¹ | | ✅ | | 👁️ | 👁️ | | | |
| Approve "Ready for Pickup" | ✅¹ | | ✅ | | | | | | |
| Handle damaged/missing items | ✅¹ | | ✅ | | | | | | |
| View all tickets | ✅¹ | | | ✅ | | | | | |
| Assign tickets to agents | ✅¹ | | | ✅ | | | | | |
| Delete tickets | ✅¹ | | | ✅ | | | | | |
| Approve/reject delete requests | ✅¹ | | | ✅ | | | | | |
| View all comments | ✅¹ | | | ✅ | | | | | |
| Delete comments | ✅¹ | | | ✅ | | | | | |
| Sentiment analytics | ✅¹ | | | ✅ | | | | | |
| Prepare items for delivery | | | | | ✅ | | | | |
| Mark "preparing" | | | | | ✅ | | | | |
| Pick/pack/verify items | | | | | | ✅ | | | |
| Mark "packed/ready" | | | | | | ✅ | | | |
| Accept/decline delivery jobs | | | | | | | ✅ | | |
| Pickup/deliver items | | | | | | | ✅ | | |
| Upload proof photos | | | | | | | ✅ | | |
| Report delivery issues | | | | | | | ✅ | | |
| Track earnings | | | | | | | ✅ | | |
| Update location | | | | | | | ✅ | | |
| Respond to assigned tickets | | | | | | | | ✅ | |
| Update ticket status | | | | | | | | ✅ | |
| Request ticket deletion | | | | | | | | ✅ | |
| Browse/search products | | | | | | | | | ✅ |
| Cart/wishlist/checkout | | | | | | | | | ✅ |
| View own orders | | | | | | | | | ✅ |
| Cancel own orders | | | | | | | | | ✅ |
| Create tickets | | | | | | | | | ✅ |
| Add comments/ratings | | | | | | | | | ✅ |

> ✅¹ = Admin override (can do anything, but shouldn't be doing daily ops)
> 👁️² = Warehouse Manager sees orders in preparation stages only
> 👁️³ = Seller sees incoming orders (paid) that need preparation
> ✅⁴ = Seller can mark: `paid → preparing`
> ✅⁵ = Warehouse Staff can mark: `preparing → packed`

---

## New Order Flow

**Current:** `created → paid → shipped → delivered`

**New:**
```
created → paid → preparing → packed → ready_for_pickup → assigned → picked_up → delivering → delivered
                  (seller)   (wh_staff)  (wh_manager)     (ops_mgr)   (driver)    (driver)    (driver)
```

| Status | Set By | Description |
|---|---|---|
| `created` | System (checkout) | Order placed by customer |
| `paid` | System (payment) | Payment confirmed |
| `preparing` | Seller | Seller starts preparing items |
| `packed` | Warehouse Staff | Items picked, packed, verified |
| `ready_for_pickup` | Warehouse Manager | Approved and ready for driver |
| `assigned` | Operations Manager | Driver assigned to delivery |
| `picked_up` | Driver | Driver picked up the package |
| `delivering` | Driver | Driver on the way |
| `delivered` | Driver | Order delivered to customer |
| `cancelled` | Ops Manager / Customer | Order cancelled |

---

## Backend Changes — File by File

### 1. [models.py](file:///c:/fastapi-ecommerce-main/app/models.py)
- Update `DBUser.role` server_default options documentation
- No structural model changes needed (role is already a String column)

### 2. [schemas.py](file:///c:/fastapi-ecommerce-main/app/schemas.py)
```python
# FROM:
class UserRole(str, Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"
    CUSTOMER = "customer"
    DRIVER = "driver"

# TO:
class UserRole(str, Enum):
    ADMIN = "admin"
    OPERATIONS_MANAGER = "operations_manager"
    WAREHOUSE_MANAGER = "warehouse_manager"
    SUPPORT_MANAGER = "support_manager"
    SELLER = "seller"
    WAREHOUSE_STAFF = "warehouse_staff"
    DRIVER = "driver"
    SUPPORT_AGENT = "support_agent"
    CUSTOMER = "customer"
```
- Update ALL `validate_role` methods across `UserBase`, `UserUpdate`, `User`, `UserRoleUpdate`
- Add new order statuses to `OrderStatusUpdate` validator: `preparing`, `packed`, `ready_for_pickup`

### 3. [admin.py](file:///c:/fastapi-ecommerce-main/app/routers/admin.py) — Role Guards

```python
# NEW guard functions:
require_admin                # ["admin"]
require_operations_manager   # ["admin", "operations_manager"]
require_warehouse_manager    # ["admin", "warehouse_manager"]
require_support_manager      # ["admin", "support_manager"]
require_any_manager          # ["admin", "operations_manager", "warehouse_manager", "support_manager"]
require_seller               # ["admin", "operations_manager", "seller"]
require_warehouse_staff      # ["admin", "warehouse_manager", "warehouse_staff"]
require_support_agent        # ["admin", "support_manager", "support_agent"]
require_driver               # ["admin", "operations_manager", "driver"]
```

### 4. [products.py](file:///c:/fastapi-ecommerce-main/app/routers/products.py)

| Endpoint | Current → New Guard |
|---|---|
| `POST /products/create` | `require_admin` → `require_seller` |
| `PUT /products/{id}` | `require_admin` → `require_seller` |
| `DELETE /products/{id}` | `require_admin` → `require_seller` |
| `PATCH /products/{id}/discount` | `require_admin` → `require_seller` |
| `GET /products/alladmin` | `require_admin` → `require_seller` |
| `GET /products/filter/admin` | `require_admin` → `require_seller` |
| `GET /products/{id}` (admin) | `require_admin` → `require_seller` |
| `GET /products/name/byadmin` | `require_admin` → `require_seller` |

### 5. [Categories.py](file:///c:/fastapi-ecommerce-main/app/routers/Categories.py)

| Endpoint | Current → New Guard |
|---|---|
| `POST /Categories/create` | `require_admin` → `require_seller` |
| `GET /Categories/all` | `require_admin` → `require_seller` |
| `GET /Categories/name` | `require_admin` → `require_seller` |
| `GET /Categories/{id}` | `require_admin` → `require_seller` |
| `PUT /Categories/{id}` | `require_admin` → `require_seller` |
| `DELETE /Categories/{id}` | `require_admin` → `require_seller` |

### 6. [order.py](file:///c:/fastapi-ecommerce-main/app/routers/order.py)

| Endpoint | Current → New Guard |
|---|---|
| `GET /orders/all` | `require_admin` → `require_operations_manager` |
| `PATCH /orders/{id}/status` | `require_admin` → **role-based logic** (see below) |

**Order status transition rules by role:**
```python
# Who can set which status:
ROLE_STATUS_TRANSITIONS = {
    "seller":              {"paid": "preparing"},
    "warehouse_staff":     {"preparing": "packed"},
    "warehouse_manager":   {"packed": "ready_for_pickup"},
    "operations_manager":  {"ready_for_pickup": "assigned", "*": "cancelled"},
    "admin":               {"*": "*"},  # can do anything
}
```

**New endpoints:**
- `GET /orders/incoming` — `require_seller` — orders with status `paid`
- `GET /orders/preparation` — `require_warehouse_staff` — orders with status `preparing`
- `GET /orders/ready-approval` — `require_warehouse_manager` — orders with status `packed`

### 7. [ticket.py](file:///c:/fastapi-ecommerce-main/app/routers/ticket.py)

| Endpoint | Current → New Guard |
|---|---|
| `GET /tickets/all` | `require_admin` → `require_support_manager` |
| `PATCH /tickets/{id}/assign` | `require_admin` → `require_support_manager` |
| `DELETE /tickets/{id}` | `require_admin` → `require_support_manager` |
| `GET /tickets/pending-deletes` | `require_admin` → `require_support_manager` |
| `POST /tickets/{id}/approve-delete` | `require_admin` → `require_support_manager` |
| `POST /tickets/{id}/reject-delete` | `require_admin` → `require_support_manager` |
| `GET /tickets/assigned` | `require_employee` → `require_support_agent` |
| Ticket status update | employee check → support_agent check |
| Ticket responses | employee check → support_agent check |
| Request delete | employee check → support_agent check |

### 8. [delivery.py](file:///c:/fastapi-ecommerce-main/app/routers/delivery.py)

| Endpoint | Current → New Guard |
|---|---|
| `GET /delivery/all-jobs` | `require_admin` → `require_operations_manager` |
| `POST /delivery/jobs/{id}/photo-review` | `require_admin` → `require_operations_manager` |
| `PATCH /delivery/jobs/{id}/issue/resolve` | `require_admin` → `require_operations_manager` |
| `GET /delivery/jobs/{id}/details` | `require_employee` → `require_operations_manager` |
| Issue chat access | admin check → ops_manager check |

### 9. [comment.py](file:///c:/fastapi-ecommerce-main/app/routers/comment.py)

| Endpoint | Current → New Guard |
|---|---|
| `GET /comments/all` | `require_admin` → `require_support_manager` |
| `DELETE /comments/{id}` | admin check in code → support_manager check |
| `GET /sentiment-analytics` | `require_admin` → `require_support_manager` |
| `POST /backfill-sentiment` | `require_admin` → `require_support_manager` |

### 10. [users.py](file:///c:/fastapi-ecommerce-main/app/routers/users.py) — NO GUARD CHANGES
- Only update role validation lists to include all 9 roles
- All user CRUD stays `require_admin`

### 11. [admin_settings.py](file:///c:/fastapi-ecommerce-main/app/routers/admin_settings.py) — NO CHANGES
- Stays `require_admin` for everything

### 12. [login.py](file:///c:/fastapi-ecommerce-main/app/routers/login.py)
- Update registration role validation to include all 9 roles
- Update login response to include role for frontend redirect

---

## ⚠️ Frontend Design Rules — Match Existing Patterns

> All new pages MUST follow the exact same patterns and styles used in the existing project. No new design systems, no new CSS frameworks, no visual inconsistencies.

### Existing Pattern Reference

**File structure pattern:**
```
src/
├── pages/
│   ├── admin/           ← AdminProducts.js, AdminOrders.js, etc.
│   ├── employee/        ← EmployeeDashboard.js, EmployeeTickets.js
│   └── driver/          ← DriverDashboard.js, DriverActiveJob.js
├── layouts/
│   ├── AdminLayout.js   ← sidebar + content area
│   ├── EmployeeLayout.js
│   └── DriverLayout.js
├── styles/
│   ├── pages/admin/     ← AdminProducts.css, AdminOrders.css, etc.
│   ├── pages/employee/  ← EmployeeDashboard.css, EmployeeTickets.css
│   ├── pages/driver/    ← DriverDashboard.css, etc.
│   └── layouts/         ← AdminLayout.css, EmployeeLayout.css, etc.
└── components/          ← shared components (ProtectedRoute, LoadingSpinner, etc.)
```

### Rules to Follow

1. **Same CSS pattern** — Each page gets its own `.css` file in `styles/pages/{role}/`. Use vanilla CSS with the same class naming conventions as existing pages (e.g., `.admin-products`, `.employee-dashboard`).

2. **Same layout pattern** — Each role gets a Layout component with sidebar navigation + content area, following the same structure as `AdminLayout.js` and `EmployeeLayout.js`.

3. **Same component patterns** — Use the same table styles, card styles, button styles, modal patterns, loading spinners, and toast notifications already used in admin pages.

4. **Same color scheme** — Follow the existing dark theme / color variables. Do NOT introduce new colors or design tokens.

5. **Reuse existing components** — `LoadingSpinner`, `Skeleton`, `ProtectedRoute`, `Toast`, `ChatWidget` must be reused, not recreated.

6. **Same data fetching pattern** — Use the same `fetch` + `authFetch` pattern with the same error handling approach used in existing pages.

7. **Same responsive patterns** — Follow the same media queries and breakpoints as existing admin/employee pages.

8. **Reuse page logic** — For pages that do the same thing as admin pages (e.g., `SupportManagerTickets` does the same as `AdminTickets`), extract shared logic into reusable components rather than copy-pasting entire files. The shared component renders the same UI; only the guard/role check differs.

---

## Frontend Changes

### New Layouts (6 new files)

| File | Role |
|---|---|
| `layouts/OpsManagerLayout.js` | operations_manager |
| `layouts/WarehouseManagerLayout.js` | warehouse_manager |
| `layouts/SupportManagerLayout.js` | support_manager |
| `layouts/SellerLayout.js` | seller |
| `layouts/WarehouseStaffLayout.js` | warehouse_staff |
| Rename `layouts/EmployeeLayout.js` → `layouts/SupportAgentLayout.js` | support_agent |

### New Pages (16 new files)

**Operations Manager** (`pages/ops-manager/`):
| Page | Description |
|---|---|
| `OpsManagerDashboard.js` | Order stats, delivery overview, driver performance |
| `OpsManagerOrders.js` | All orders view + status management (reuse AdminOrders) |
| `OpsManagerDeliveries.js` | All deliveries + photo review + issue resolve (reuse AdminDeliveries) |

**Warehouse Manager** (`pages/warehouse-manager/`):
| Page | Description |
|---|---|
| `WarehouseManagerDashboard.js` | Stock alerts, preparation queue, approval queue |
| `WarehouseManagerInventory.js` | Stock levels, low-stock alerts |
| `WarehouseManagerApprovals.js` | Orders with status `packed` awaiting approval |

**Support Manager** (`pages/support-manager/`):
| Page | Description |
|---|---|
| `SupportManagerDashboard.js` | Ticket stats, agent workload |
| `SupportManagerTickets.js` | All tickets + assign + delete (reuse AdminTickets) |
| `SupportManagerComments.js` | Comment moderation (reuse AdminComments) |

**Seller** (`pages/seller/`):
| Page | Description |
|---|---|
| `SellerDashboard.js` | Product stats, incoming orders count |
| `SellerProducts.js` | Product CRUD (reuse AdminProducts) |
| `SellerCategories.js` | Category CRUD (reuse AdminCategories) |
| `SellerOrders.js` | Incoming orders (`paid`) to start preparing |

**Warehouse Staff** (`pages/warehouse-staff/`):
| Page | Description |
|---|---|
| `WarehouseStaffDashboard.js` | Orders to pack count |
| `WarehouseStaffOrders.js` | Orders with status `preparing` to pack/verify |

**Support Agent** (rename existing `pages/employee/`):
| Page | Description |
|---|---|
| `SupportAgentDashboard.js` | Rename from EmployeeDashboard |
| `SupportAgentTickets.js` | Rename from EmployeeTickets |

### Modified Pages

| File | Change |
|---|---|
| `App.js` | Add 6 new route groups with ProtectedRoute for each role |
| `ProtectedRoute.js` | Add props for all 9 roles |
| `AdminDashboard.js` | Narrow to: Users, Settings, Analytics only |
| Remove from admin routes | Products, Categories, Orders, Deliveries, Tickets, Comments, Discounts |

### Login Redirect Logic
```
admin             → /admin
operations_manager → /ops-manager
warehouse_manager  → /warehouse-manager
support_manager    → /support-manager
seller            → /seller
warehouse_staff   → /warehouse-staff
driver            → /driver
support_agent     → /support-agent
customer          → /
```

---

## Database Migration

```sql
-- Migrate existing 'employee' users to 'support_agent'
UPDATE users SET role = 'support_agent' WHERE role = 'employee';

-- Add new order statuses (no schema change needed, just validation)
-- New valid statuses: created, paid, preparing, packed, ready_for_pickup,
--                     assigned, picked_up, delivering, delivered, cancelled
```

---

## Implementation Phases

### Phase 1: Backend Foundation
1. Update `UserRole` enum and all validators (9 roles)
2. Create all guard functions in `admin.py`
3. Update all endpoint guards across all routers
4. Add new order statuses + transition rules
5. Add new order endpoints (incoming, preparation, approvals)
6. DB migration: `employee` → `support_agent`

### Phase 2: Operations Manager + Seller Frontend
1. Create OpsManager layout + pages (orders, deliveries)
2. Create Seller layout + pages (products, categories, incoming orders)
3. Update App.js routing

### Phase 3: Warehouse + Support Frontend
1. Create WarehouseManager layout + pages (inventory, approvals)
2. Create WarehouseStaff layout + pages (pack/verify queue)
3. Create SupportManager layout + pages (tickets, comments)
4. Rename Employee → SupportAgent pages

### Phase 4: Admin Narrowing + Polish
1. Narrow AdminDashboard to users/settings/analytics
2. Remove redundant admin pages (products, orders, etc.)
3. Test all role transitions end-to-end
4. Polish navigation and UI
