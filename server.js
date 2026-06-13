const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // import module mongoose
const User = require('./models/user');
const Product = require('./models/product');
const Cart = require('./models/cart');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');





mongoose.connect('mongodb://127.0.0.1:27017/FURI');


const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Ensure this folder exists
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Simple test route
app.get('/api/hello', (req, res) => {
    res.json({ message: "Hello from backend!" });
});

//add admin
app.post('/admin/register',async (req, res) => {
    try {
        
        const { fullName, email, password } = req.body;
        

        // Simple validation
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create admin user
        const newAdmin = new User({
            fullName,
            email,
            password: hashedPassword,
            role: 'admin' 
        });

        await newAdmin.save();
        res.status(201).json({ message: 'Admin created successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Inscription
app.post('/users/inscri', async (req, res) => {

    try {
        const { fullName, email, password } = req.body;

        // Simple validation
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
            role : 'user'
        });


        const savedUser = await newUser.save();
        console.log('User successfully saved:');
        res.status(201).json({ message: 'User created successfully' });

    } catch (error) {

        res.status(500).json({ message: error.message });

    }
});

// login implementation
app.post('/login', async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await User.findOne({ email });
        const isMatch = user ? await bcrypt.compare(password, user.password) : false;

        if (!user || !isMatch) {
            return res.status(401).json({ message: 'Email or password incorrect' });
        }

        // Generate JWT (Use a strong secret key in production)
        const token = jwt.sign({ id: user._id, fullName: user.fullName, role: user.role}, 'MY_SECRET_KEY', { expiresIn: '2h' });

        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// get all users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//getuserbyId
app.get('/users/:id', async (req, res) => {
    try {
        console.log('request received')
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// update user by ID
app.patch('/users/edit/:id', async (req, res) => {
    try {

        const { id } = req.params;
        const { fullName, email } = req.body;
        const updateData = {};

        if (fullName) {
            updateData.fullName = fullName;
        }
        if (email) {
            // Check if the new email already exists for another user
            const existingUserWithEmail = await User.findOne({ email, _id: { $ne: id } });
            if (existingUserWithEmail) {
                return res.status(400).json({ message: 'Email already in use by another user' });
            }
            updateData.email = email;
        }


        const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//delete user
app.delete('/users/delete/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// *** products ***

//create product
app.post('/products/create', upload.single('image'), async (req, res) => {
    try {

        const { name, price, description, qte } = req.body;
        const image = req.protocol + '://' + req.get('host') + '/uploads/' + req.file ? req.file.filename : '';


        const newProduct = new Product({
            name,
            price,
            description,
            qte,
            image
        });

        await newProduct.save();
        res.status(201).json({ message: 'Product created successfully' });

    } catch (error) {

        res.status(500).json({ message: error.message });
    }
});

//update product
app.put('/products/edit/:id', upload.single('image'), async (req, res) => {
    try {

        const { name, price, description, qte } = req.body;
        const updateData = { name, price, description, qte };

        if (req.file) {
            updateData.image = req.protocol + '://' + req.get('host') + '/uploads/' + req.file ? req.file.filename : '';
        }

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//get all products
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//get product by id
app.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//delete product
app.delete('/products/delete/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


//**********   Carts */


app.post('/carts/add', async (req, res) => {
    try {


        const userId = req.body.userId
        const productId = req.body.product._id
        const qte = parseInt(req.body.quantity)
        const price = parseInt(req.body.product.price)



        if (!userId || !productId || !qte || !price) {
            return res.status(400).json({ message: 'Missing required fields' });
        }


        // Check if the product exists
        const productExists = await Product.findById(productId);
        if (!productExists) {
            return res.status(404).json({ message: 'Product not found' });
        }

        let cart = await Cart.findOne({ userId });

        if (cart) {

            // If cart exists, check if product is already in it
            const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);



            if (itemIndex > -1) {
                // product exists

                cart.items[itemIndex].quantity += qte;

                // update quantity in existing product


            } else {

                cart.items.push({ productId, qte: qte, price: price });
            }
            await cart.save();
        } else {

            // If no cart exists, create one
            cart = new Cart({
                userId,
                items: [{ productId, qte: qte, price: productExists.price }]
            });
            await cart.save();


        }


        Product.findByIdAndUpdate(productId, { qte: productExists.qte - qte }, { new: true }).then(product => {

        })


        res.status(200).json({ message: 'Product added to cart', cart });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// get all carts
app.get('/carts', async (req, res) => {
    try {

        const carts = await Cart.find()
            .populate('userId', 'fullName email')
            .populate('items.productId', 'name price qte image');
        res.status(200).json(carts);
    } catch (error) {
        res.status(500).json({ message: error.message });

    }
});

// update cart ( quantity )

app.put('/carts/update-quantity', async (req, res) => {
    try {

        const userId = req.body.userId
        const productId = req.body.item
        const quantity = req.body.quantity


        const newQuantity = parseInt(quantity);


        if (!userId || !productId || isNaN(newQuantity)) {
            return res.status(400).json({ message: 'Missing or invalid fields (userId, productId, quantity)' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const currentQtyInCart = cart.items[itemIndex].quantity;



        // If increasing quantity, check stock availability
        if (newQuantity > 0 && product.qte == 0) {
            return res.status(400).json({ message: 'Insufficient stock available' });
        }
        else if (newQuantity > 0) {
            // add to cart remove from product
            product.qte -= newQuantity
            cart.items[itemIndex].quantity += newQuantity;
        }
        else if (newQuantity < 0) {
            // remove from cart add to product
            product.qte -= newQuantity
            cart.items[itemIndex].quantity += newQuantity;


        }

        // update product quantity
        await product.save();


        if (cart.items[itemIndex].quantity == 0) {
            cart.items.splice(itemIndex, 1);
        }

        await cart.save();
        res.status(200).json({ message: 'Cart updated successfully', cart });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
