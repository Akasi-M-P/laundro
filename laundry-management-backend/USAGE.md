# API Usage Examples

Base URL: `http://localhost:5000/api/v1`

## Authentication

### 1. Register a New Shop
**Endpoint:** `POST /auth/register-shop`

```json
{
  "businessName": "Fresh Laundry Co.",
  "phone": "9876543210",
  "location": "456 Market Street",
  "ownerName": "Alice Smith",
  "email": "alice@example.com",
  "password": "securePassword123"
}
```
*Response includes `token`, `shop`, and `user` details.*

### 2. Login (Owner)
**Endpoint:** `POST /auth/login`

```json
{
  "email": "alice@example.com",
  "password": "securePassword123"
}
```
*Response includes access `token`.*

### 3. Request OTP (Employee)
**Endpoint:** `POST /auth/otp-request`

```json
{
  "phoneNumber": "employee@example.com"
}
```
*Note: In this MVP, `phoneNumber` maps to the employee's email/username field.*

### 4. Verify OTP (Employee)
**Endpoint:** `POST /auth/otp-verify`

```json
{
  "phoneNumber": "employee@example.com",
  "otp": "123456"
}
```
*Response includes access `token`.*

---

## Orders
**Headers Required:** `Authorization: Bearer <YOUR_TOKEN>`

### 5. Create Order
**Endpoint:** `POST /orders`

```json
{
  "customerId": "cust_001",
  "items": [
    { "name": "Shirt", "quantity": 2, "price": 50 },
    { "name": "Trousers", "quantity": 1, "price": 100 }
  ],
  "totalAmount": 200,
  "amountPaid": 0
}
```
*Response includes the created order object with `_id`.*

### 6. Mark Order as Ready
**Endpoint:** `PUT /orders/:id/ready`
*Replace `:id` with the actual Order ID.*

**Body:** (Empty)

*Response includes `_tempPin` (for testing/MVP only).*

### 7. Collect Order
**Endpoint:** `POST /orders/:id/collect`
*Replace `:id` with the actual Order ID.*

```json
{
  "pin": "1234"
}
```
*Requires the valid PIN generated in the "Mark Ready" step.*

---

## Payments
**Headers Required:** `Authorization: Bearer <YOUR_TOKEN>`

### 8. Record Payment
**Endpoint:** `POST /payments`

```json
{
  "orderId": "65a1b2c3d4e5f67890123456",
  "amount": 100,
  "method": "CASH"
}
```
*Supported methods: `CASH`, `CARD`, `UPI`.*

---

## Shop Management (Admin Only)

### 9. Suspend/Activate Shop
**Endpoint:** `PUT /shops/:id/status`
*Replace `:id` with the Shop ID.*

```json
{
  "status": "SUSPENDED",
  "reason": "Non-payment of subscription"
}
```
*Status options: `ACTIVE`, `SUSPENDED`, `INACTIVE`.*
