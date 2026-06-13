# FURI Backend API

A simple e-commerce backend built with **Node.js**, **Express**, **MongoDB**, and **Mongoose**. It provides user authentication, product management, file uploads, and shopping cart functionality.

## Features

* User Registration
* User Login with JWT Authentication
* Admin Registration
* User Management (CRUD)
* Product Management (CRUD)
* Image Uploads using Multer
* Shopping Cart Management
* MongoDB Database Integration

---

## Technologies Used

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT (JSON Web Token)
* bcrypt
* Multer
* CORS

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd project-folder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start MongoDB

Make sure MongoDB is running locally on:

```bash
mongodb://127.0.0.1:27017/FURI
```

### 4. Run the server

```bash
node server.js
```

Server will start on:

```bash
http://localhost:3000
```

---

## API Endpoints

### Authentication

#### Register User

```http
POST /users/inscri
```

Request Body:

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "123456"
}
```

---

#### Register Admin

```http
POST /admin/register
```

---

#### Login

```http
POST /login
```

Request Body:

```json
{
  "email": "john@example.com",
  "password": "123456"
}
```

Returns:

```json
{
  "token": "jwt_token"
}
```

---

## User Management

### Get All Users

```http
GET /users
```

### Get User By ID

```http
GET /users/:id
```

### Update User

```http
PATCH /users/edit/:id
```

### Delete User

```http
DELETE /users/delete/:id
```

---

## Product Management

### Create Product

```http
POST /products/create
```

Form Data:

* name
* price
* description
* qte
* image (file)

### Get All Products

```http
GET /products
```

### Get Product By ID

```http
GET /products/:id
```

### Update Product

```http
PUT /products/edit/:id
```

### Delete Product

```http
DELETE /products/delete/:id
```

---

## Cart Management

### Add Product to Cart

```http
POST /carts/add
```

### Get All Carts

```http
GET /carts
```

### Update Cart Quantity

```http
PUT /carts/update-quantity
```

---

## Uploads

Uploaded product images are stored inside:

```bash
/uploads
```

and served through:

```http
http://localhost:3000/uploads/<image-name>
```

---

## Project Structure

```text
project/
│
├── models/
│   ├── user.js
│   ├── product.js
│   └── cart.js
│
├── uploads/
│
├── server.js
├── package.json
└── README.md
```

---

## Notes

* Passwords are securely hashed using bcrypt.
* JWT tokens expire after 2 hours.
* MongoDB must be running before starting the server.
* The uploads folder must exist before uploading images.

## Author

FURI Backend API Project
