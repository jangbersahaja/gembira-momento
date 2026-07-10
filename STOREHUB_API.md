# StoreHub API Documentation

## General Information

- **Protocol**: HTTPS
- **Host**: api.storehubhq.com
- **Request Format**: JSON
- **Response Format**: JSON
- **Date Format**: ISO 8601 (e.g., `1970-01-01T00:00:00Z`)

## Authentication

All APIs are authenticated via basic HTTP authentication.

- **Username**: Your store name (subdomain of the back-office URL)
- **Password**: Your API token (auto-generated; contact your StoreHub sales representative to retrieve this)

## Rate Limiting

- **Limit**: 3 calls per second
- Exceeding this will return an error
- Please contact StoreHub customer success to remove limits, noting that repeated abuse may result in a permanent block

---

## 1. Products

### Get Product List

- **URL**: `/products`
- **Verb**: GET
- **Response**: Array of product objects

### Get Product by Id

- **URL**: `/products/<id>`
- **Verb**: GET
- **Response**: Returns a specific product object or 404 if not found

### Product Schema

| Field           | Type    | Description              |
| --------------- | ------- | ------------------------ |
| id              | String  | Unique identifier        |
| name            | String  | Product name             |
| sku             | String  | Product SKU              |
| price           | Enum    | 'Fixed' or 'Variable'    |
| unitPrice       | Number  | Price of the product     |
| cost            | Number  | Cost of manufacture      |
| trackStockLevel | Boolean | Whether stock is tracked |
| isParentProduct | Boolean | True if has variants     |

---

## 2. Customers

### Create Customer

- **URL**: `/customers`
- **Verb**: POST
- **Body**: `refId` (Required, UUID), firstName, lastName, etc.

### Get Customer by RefId

- **URL**: `/customers/<refId>`
- **Verb**: GET

### Update Customer

- **URL**: `/customers/<refId>`
- **Verb**: PUT
- **Note**: Partial updates are not supported; missing properties will be removed

---

## 3. Inventory

### Get Inventory

- **URL**: `/inventory/<storeId>`
- **Verb**: GET
- **Response**: Array of stock objects including `quantityOnHand`, `warningStock`, and `idealStock`

---

## 4. Transactions

### Get Transactions

- **URL**: `/transactions`
- **Verb**: GET
- **Parameters**:
  - `from` (YYYY-MM-DD)
  - `to` (YYYY-MM-DD)
  - `storeId`
  - `includeOnline`
  - `onlineOnly`

### Add Transaction

- **URL**: `/transactions`
- **Verb**: POST
- **Note**: All numbers must be tax-exclusive. Return transactions must be submitted as separate transactions, linked via `saleInvoiceNumber`

### Cancel Transaction

- **URL**: `/transactions/<refId>/cancel`
- **Verb**: POST

---

## 5. Staff & Operations

### Get All Employees

- **URL**: `/employees`
- **Verb**: GET
- **Parameters**: `modifiedSince` (Date - Optional)

#### Employee Schema

| Field        | Type   | Description                               |
| ------------ | ------ | ----------------------------------------- |
| id           | String | Unique Id of the employee                 |
| firstName    | String | First name of the employee                |
| lastName     | String | Last name of the employee                 |
| email        | String | Email of the employee                     |
| phone        | String | Phone of the employee                     |
| createdTime  | Date   | Time of employee added to StoreHub system |
| modifiedTime | Date   | Last time the employee was modified       |

### Get All Stores

- **URL**: `/stores`
- **Verb**: GET

#### Store Schema

| Field      | Type   | Description                     |
| ---------- | ------ | ------------------------------- |
| id         | String | Unique Id of the store          |
| name       | String | Name of the store               |
| address1   | String | Address line 1 of the store     |
| address2   | String | Address line 2 of the store     |
| city       | String | City the store is located in    |
| state      | String | State the store is located in   |
| country    | String | Country the store is located in |
| postalCode | String | Postal code of the store        |
| phone      | String | Store's phone number            |
| email      | String | Store's email address           |
| website    | String | Store's website                 |

### Search Timesheets

- **URL**: `/timesheets`
- **Verb**: GET
- **Parameters**:
  - `storeId` (String - Optional)
  - `employeeId` (String - Optional)
  - `from` (Date - Optional, search records with clock in after this time)
  - `to` (Date - Optional, search records with clock in before this time)

#### Timesheet Schema

| Field        | Type   | Description                                        |
| ------------ | ------ | -------------------------------------------------- |
| employeeId   | String | Unique Id of the employee                          |
| storeId      | String | Unique Id of the store where timesheet was created |
| clockInTime  | String | When the employee clocked in                       |
| clockOutTime | String | When the employee clocked out                      |
