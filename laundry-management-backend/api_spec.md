# API Endpoint Definitions

Base URL: `/api/v1`

## Authentication (`/auth`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/register-shop` | Register a new shop | Public |
| POST | `/login` | User login | Public |
| POST | `/otp-request` | Request OTP for verification | Public |
| POST | `/otp-verify` | Verify OTP | Public |

## Orders (`/orders`)
**Base Path:** `/api/v1/orders`
**Protection:** Bearer Token required

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/` | Create a new order | Owner, Employee |
| PUT | `/:id/ready` | Mark an order as ready | Owner, Employee |
| POST | `/:id/collect` | Mark an order as collected | Owner, Employee |

## Payments (`/payments`)
**Base Path:** `/api/v1/payments`
**Protection:** Bearer Token required

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| POST | `/` | Record a payment | Owner, Employee |

## Shops (`/shops`)
**Base Path:** `/api/v1/shops`
**Protection:** Bearer Token required

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| PUT | `/:id/status` | Update shop status (Suspend/Reactivate) | Admin |

## Health Check
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/` | API Health Check | Public |
