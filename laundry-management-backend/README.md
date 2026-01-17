Laundry Management Backend (MVP)
Overview

This project is the backend API for a laundry management system designed for small and medium laundry shops operating in low-internet environments.

The system replaces paper notebooks with a secure, offline-friendly, audit-driven platform that helps laundry owners:

Track orders accurately

Prevent disputes during pickup

Control staff actions

Track payments and balances

Enforce subscription access

This is a paid MVP, not a feature-heavy enterprise system.

Core Problems This System Solves

Lost or damaged paper records

Customers claiming they didn’t collect items

Wrong items given to customers

Helpers undercharging or overcharging

Owners losing control when absent

Business interruption due to theft or loss of notebooks

Core Principles

Trust over convenience

Offline-first, not offline-optional

Strict role separation

Immutable financial records

Audit everything

Owners stay in control

Key Concepts
1. Shop-Based Isolation

Every record belongs to exactly one shop

No cross-shop data access

Employees cannot exist without a shop

2. Roles & Permissions
Role	Description
The owner	has full control of the shop, pricing, staff, and reports
Helper	can create and process orders, cannot override money or security
Admin	Platform-level control (subscriptions, suspensions)

Permissions are deny-by-default.

3. Order Lifecycle (High-Level)
CREATED → PROCESSING → READY → COLLECTED


Rules:

Orders cannot skip states

Collection requires a valid pickup PIN

Partial payments must be settled before collection

Pricing is snapshotted at order creation

4. Pickup Security

Each order generates a unique pickup PIN

PIN is sent only to the customer (SMS / WhatsApp)

PIN is hashed in the database

Orders cannot be collected without PIN verification

Every collection action is audit-logged

5. Offline-First Design

Core actions work without the internet:

Create order

Add payment

Update status

Actions are queued locally and synced when online

Server is the source of truth

Conflicts are resolved deterministically

6. Audit Logging

Every critical action is logged automatically:

Order creation

Payments

Status changes

Collection

Employee actions

Admin interventions

Audit logs are append-only and immutable.

7. Subscription Enforcement

Shops operate on a monthly subscription

Unpaid shops are automatically:

Restricted to read-only mode

Blocked from creating new orders

Admins can suspend or reactivate shops

Grace periods are configurable

What This MVP Includes

Authentication (Owner & Helper)
Shop onboarding
Employee management
Pricing configuration
Order intake & collection
Payment tracking
Pickup PIN security
Offline sync logic
Audit logging
Subscription enforcement

What This MVP Does NOT Include (Intentionally)

AI features
Advanced analytics
Automated payment gateways
Customer mobile app
Inventory management
Multi-currency support

These may come later — not MVP.

Tech Stack (Planned)

Node.js

Express.js

MongoDB

JWT Authentication

REST API

Mobile-first client (separate project)

Project Structure (High-Level)
/src
  /config
  /modules
  /middlewares
  /routes
  /jobs
  /utils
  /docs


Each business concept lives in its own module.

Development Philosophy

Database-first design

Thin controllers, strong services

Strict validation

Clear API contracts

Security over shortcuts

Ship small, test with real shops

Target Users

Small laundry shop owners

Local laundry operators with 1–5 helpers

Businesses currently using notebooks or WhatsApp

Status

MVP in active development
This repository is under rapid iteration and subject to change.

License

Private / Proprietary
Not open-source at this stage.

Final Note

This system is designed to reduce stress, prevent disputes, and protect revenue
for small laundry business owners.

If a feature does not support that goal, it does not belong here.
