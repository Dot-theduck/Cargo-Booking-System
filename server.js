const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 5001;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ejs = require('ejs');
const passport = require('passport');
const session = require('express-session');
const axios = require('axios');
const unirest = require('unirest');
const moment = require('moment');
const crypto = require('crypto');
const multer = require('multer');
const { diskStorage } = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const nodemailer = require('nodemailer');




// Connecting to sqlite database
const db = new sqlite3.Database('cargoBookingSystem.db');

// Setting the vies engine to EJS
app.set('view engine', 'ejs');

// Specifying the directory for the views
app.set('views', path.join(__dirname, 'public', 'userManagement', 'admin','views'));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(bodyParser.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API clients)
app.use(bodyParser.json());

// Setting static directories
app.use('/userManagement/customer', express.static(path.join(__dirname, 'public', 'userManagement', 'customer')));
app.use('/paymentProcessing', express.static(path.join(__dirname, 'public', 'paymentProcessing')));
app.use('/userManagement', express.static(path.join(__dirname, 'public', 'userManagement')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/includes', express.static(path.join(__dirname, 'public', 'includes')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/cargoTracking', express.static(path.join(__dirname, 'public', 'cargoTracking')));

// Adding the express-session middleware
app.use(session({
      secret: '123456789',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }
    })
  );

// Nodemailer configuration 
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'adisoncheruiyot55@gmail.com', // replace with company's email
        pass: 'bumhndgrvrnuapol' // replace with company's email password
    }
});



// ========================= Authentication logics ====================================
let isAuthenticated = false;

// Authentication for customers
const checkIsAuthenticated = (req, res, next) => {
    if (isAuthenticated) {
        next();
    } else {
        res.redirect('/customer/login');
    }
};

// Authentication for admins
const checkAuthentication = (req, res, next) => {
    if (isAuthenticated) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Definning fileFilter function
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];

const fileFilter = (req, file, cb) => {
    if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};




// ======================================== ADMIN ROUTES======================================

// Function to get the total count for a specific status from the database
async function getTotalStatusCountFromDB(status) {
    try {
        const result = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) AS totalCount FROM cargo_booking WHERE status = ? COLLATE NOCASE', [status], (err, result) => {
                if (err) {
                    console.error(err);
                    reject(err);
                }
                resolve(result);
            });
        });
        if (!result || !result.totalCount) {
            console.error(`Error fetching total count for ${status} status. Result or totalCount is undefined.`);
            return 0;
        }

        // Extract the total count from the result
        const totalCount = result.totalCount;
        return totalCount;
    } catch (error) {
        console.error(`Error fetching total count for ${status} status:`, error);
        throw error; // Handle the error appropriately in your application
    }
}

// Function to generate total counts for different statuses
async function generateTotalStatusCounts() {
    try {
        // Use Promise.all to parallelize the database queries
        const [totalPendingCount, totalInProgressCount, totalDeliveredCount, totalReturnCount] = await Promise.all([
            getTotalStatusCountFromDB('PENDING'),
            getTotalStatusCountFromDB('IN PROGRESS'),
            getTotalStatusCountFromDB('DELIVERED'),
            getTotalStatusCountFromDB('RETURN')
        ]);
        return {
            totalPending: totalPendingCount,
            totalInProgress: totalInProgressCount,
            totalDelivered: totalDeliveredCount,
            totalReturn: totalReturnCount
        };
    } catch (error) {
        console.error('Error generating total status counts:', error);
        throw error; // Handle the error appropriately in your application
    }
}

// Logic for generating Total bookings from database CARGO_BOOKING'S table
const getTotalBookings = async () => {
    try {
        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM cargo_booking', (err, row) => {
                if (err) {
                    console.error(err.message);
                    reject(err.message);
                }
                resolve(row.count);
            });
        });
    } catch (err) {
        console.error(err);
        throw err;
    }
};

// Logic for generating Total customers from the database CUSTOMER'S TABLE
const getTotalCustomers = async () => {
    try {
        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
                if (err) {
                    console.error(err.message);
                    reject(err.message);
                }
                resolve(row.count);
            });
        });
    } catch (err) {
        console.error(err);
        throw err;
    }
};

// Function to retrieve total earnings from the payment table
function getTotalEarnings() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT SUM(amount) AS total_earnings FROM payment';

        db.get(query, (err, row) => {
            if (err) {
                console.error('Error executing query:', err);
                reject(err);
            } else {
                // If there is no data or total_earnings is null, resolve with 0
                resolve(row && row.total_earnings !== null ? row.total_earnings : 0);
            }
        });
    });
}

// Admin get route for login page
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userManagement', 'admin', 'login.html'));
});

// Admin get route for register page
app.get('/admin/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userManagement', 'admin', 'register.html'));
});

// Admin get route for managing users page
app.get('/admin/manageUsers', checkAuthentication, async (req, res) => {
    try {
        let customers, cargoBooking, payment;

        // Retrieving data from the customers table
        customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers', (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });

        // Retrieving data from the cargo_booking table
        cargoBooking = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM cargo_booking', (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });

        // Retrieving data from payment table
        payment = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM payment', (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                } else {
                    resolve(rows); // Make sure to resolve the promise
                }
            });
        });
        // Getting the total number of customers
        const totalCustomers = await getTotalCustomers();

        // Getting the total number of cargo bookings
        const totalBookings = await getTotalBookings();

        // Getting the status counts
        const statusCounts = await generateTotalStatusCounts();

        // Getting the total number of payments
        const totalEarnings = await getTotalEarnings();

        // Render the view with data
        res.render('manage-users', {
            payment: payment,
            customers: customers,
            cargoBooking: cargoBooking,
            isAuthenticated: isAuthenticated,  // Assuming isAuthenticated is defined
            totalCustomers: totalCustomers,
            totalBookings: totalBookings,
            statusCounts: statusCounts,
            totalEarnings: totalEarnings
        });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Admin get route for logging out
app.get('/admin/logout', (req, res) => {
    // Check if the session exists
    if (req.session) {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Internal Server Error');
            }
            isAuthenticated = false; // Set isAuthenticated to false upon successful logout
            // Redirect to the homepage after the session is destroyed
            res.redirect('/admin/login');
        });
    } else {
        console.log('session not exist');
        isAuthenticated = false; // Set isAuthenticated to false
        // If the session doesn't exist, simply redirect to the homepage
        res.redirect('/admin/login');
    }
});




// ============================= CUSTOMERS GET ROUTES ======================================

// Customer get route for customer registration page
app.get('/customer/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userManagement', 'customer', 'register.html'));
});

// Customer get route for customer login page
app.get('/customer/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userManagement', 'customer', 'login.html'));
});

// Get route for Home page
app.get('/', async (req, res) => {
    try {
        const loggedInUser = req.session.username; // Assuming you have stored the user information in the session

        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers WHERE username = ?', [loggedInUser], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });
        res.render('index', { isAuthenticated: isAuthenticated, customers: customers, loggedInUser: loggedInUser });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get route for customer's profile
app.get('/customer-details',checkIsAuthenticated, async (req, res) => {
    try {
        const loggedInUser = req.session.username;

        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers WHERE username = ?', [loggedInUser], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });
        // Ensure that the EJS template logic is placed correctly within the route
        res.render('details', { customers: customers, loggedInUser: loggedInUser }); 
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get route for FAQ page
app.get('/FAQ', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'includes', 'FAQ', 'index.html'));
});

// Get route for about us page
app.get('/about-us', async (req, res) => {
    try {
        const loggedInUser = req.session.username; // Assuming you have stored the user information in the session

        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers WHERE username = ?', [loggedInUser], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });
        res.render('aboutus', { isAuthenticated: isAuthenticated, customers: customers, loggedInUser: loggedInUser });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get route for clothngs page
app.get('/clothings', async (req, res) => {
    try {
        const loggedInUser = req.session.username; // Assuming you have stored the user information in the session

        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers WHERE username = ?', [loggedInUser], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });
        res.render('clothings', { isAuthenticated: isAuthenticated, customers: customers, loggedInUser: loggedInUser });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get route for shipment-guides page
app.get('/shipment-guides', async (req, res) => {
    try {
        const loggedInUser = req.session.username; // Assuming you have stored the user information in the session

        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers WHERE username = ?', [loggedInUser], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });
        res.render('shipment-guides', { isAuthenticated: isAuthenticated, customers: customers, loggedInUser: loggedInUser });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Get route for shipment-guides page
app.get('/contact-us', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userManagement', 'customer', 'contactus.html'));
});

// Get route for confirm order page
app.get('/order-confirm', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'paymentProcessing', 'orderconfirm.html'));
});

// Get route for update profile page
app.get('/customer/update-profile', checkIsAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userManagement', 'customer', 'update_profile.html'));
});

// Get route for change password page
app.get('/customer/change-password',checkIsAuthenticated, async (req, res) => {
    try {
        const loggedInUser = req.session.username;

        const customers = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM customers WHERE username = ?', [loggedInUser], (err, rows) => {
                if (err) {
                    console.error(err.message);
                    reject('Internal Server Error');
                }
                resolve(rows);
            });
        });
        // Ensure that the EJS template logic is placed correctly within the route
        res.render('change_password', { customers: customers, loggedInUser: loggedInUser }); 
    } catch (err) {
        res.status(500).send(err);
    }
});
// Get route for booking cargo page
app.get('/customer/book-cargo', checkIsAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'userManagement', 'customer', 'book_cargo.html'));
});

// Get route for customer logout
app.get('/customer/logout', (req, res) => {
    // Check if the session exists
    if (req.session) {
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Internal Server Error');
            }
            isAuthenticated = false; // Set isAuthenticated to false upon successful logout
            // Redirect to the homepage after the session is destroyed
            res.redirect('/');
        });
    } else {
        console.log('session not exist');
        isAuthenticated = false; // Set isAuthenticated to false
        // If the session doesn't exist, simply redirect to the homepage
        res.redirect('/');
    }
});

// Get route for payments
app.get('/payment', checkIsAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'paymentProcessing', 'payment_gateway.html'));
});

// Get routes for cargo_tracking
app.get('/view-status', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cargoTracking', 'view_cargo_status.html'));
});

// Get route for update status
app.get('/update-status', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cargoTracking', 'update_cargo_status.html'));
});

// Get route fo retrieveing cargo tracking code
app.get('/retrieve-code', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cargoTracking', 'retrieve_code.html'));
});

// Get route for tracking cargo status
app.get('/track-cargo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cargoTracking', 'track_cargo.html'))
})

app.get('/notifications', checkIsAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cargoTracking', 'notifications.html'));
});

// Get route fo email alerts
app.get('/email-alerts', checkIsAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cargoTracking', 'email_alerts.html'));
});

// Get route for track and trace
app.get('/track-and-trace', (req, res) => {
    try {
        // Retrieve the unique code from the database
        db.all('SELECT code FROM unique_code', [], (err, rows) => {
            if (err) {
                console.error('Error retrieving the unique code from the database', err);
                return res.send('Error retrieving the unique code from the database');
            }

            // Assuming there's only one unique code in the database
            const uniqueCode = rows[0].code;

            const html = `<h2>Your Unique Tracking Code: ${uniqueCode}</h2>`;
            res.send(html);
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// ==================================== ADMIN POST ROUTES ================================
// Post route for login page
app.post('/admin/login', (req, res) => {
    const { admin_username, admin_password } = req.body;
    // Checking if the provided credentials match the admins credentials in the database
    db.get('SELECT * FROM admins WHERE admin_username = ? AND admin_password = ?', [admin_username, admin_password], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        if (row) {
            isAuthenticated = true;
            res.redirect('/admin/manageUsers');
        } else {
            console.log('error')
            res.send('<script>alert("Unauthorized access"); location.href = "/admin/login";</script>');
        }
    });
});

// Post route for register page
app.post('/admin/register', (req, res) => {
    const { admin_username, admin_email, admin_password } = req.body;

    // Checking if adminEmail exists
    db.get('SELECT * FROM admins WHERE admin_email = ?', [admin_email], (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        if (row) {
            const html = '<script>alert("Admin Email already exists"); location.href = "/admin/register";</script>';
            return res.send(html);
        }

        // Insert data into the admns table
        const stmt = db.prepare("INSERT INTO admins (admin_username, admin_email, admin_password) VALUES (?, ?, ?)");
        stmt.run(admin_username, admin_email, admin_password, function(err) {
            if (err) {
                console.log(err.message);
                return res.send('Error occured during registration. Please try again');
            }
        });
        stmt.finalize();

        const html1 = '<script>alert("Admin registration successful!"); location.href = "/admin/login";</script>';
        return res.send(html1);
    });
});

// Post route for deleting booked cargo
app.post('/deleteCargo', (req, res) => {
    const uniqueCode = req.body.code;
    // Assuming db is the database connection object
    db.run('DELETE FROM cargo_booking WHERE code = ?', uniqueCode, function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.send(`<script>alert("Cargo booked by ${uniqueCode} deleted successfully"); location.href = "/admin/manageUsers";</script>`);
    });
});

// Post route for updating cargo status
app.post('/editCargo', (req, res) => {
    const uniqueCode = req.body.code; // Assuming the unique code is sent in the request body

    // Perform a search for the cargo using the unique code
    db.get('SELECT * FROM cargo_booking WHERE code = ?', uniqueCode, function(err, cargo) {
        if (err) {
            // Handle the error
            res.status(500).send('Error occurred during cargo retrieval');
        } else {
            if (cargo) {
                // Update the cargo properties based on the request body
                cargo.status = req.body.status;

                // Save the updated cargo to the database
                db.run('UPDATE cargo_booking SET status = ? WHERE code = ?', [cargo.status, uniqueCode], function(err) {
                    if (err) {
                        console.log(cargo);
                        res.status(500).send('Error occurred during cargo update');
                    } else {
                        res.redirect('/admin/manageUsers');
                    }
                });
            } else {
                // Cargo not found with the unique code
                console.log(cargo);
                res.status(404).send('Cargo not found');
            }
        }
    });
});

// Post route for deleting customers
app.post('/delete-customer', (req, res) => {
    const email = req.body.email;
    // Assuming db is the database connection object
    db.run('DELETE FROM customers WHERE email = ?', email, function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        res.send(`<script>alert("Customer named by email: ${email} has been deleted successfully"); location.href = "/admin/manageUsers";</script>`);
    });
});




// =============================== CUSTOMER POST ROUTES ===============================
// Post route for login page
app.post('/customer/login', (req, res) => {
    const { username, password } = req.body;

    // Check the user's credentials in your database
    db.get('SELECT id FROM customers WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (row) {
            // Set the username in the session
            req.session.username = username;
            isAuthenticated = true;
            res.redirect("/");
        } else {
            console.log('error')
            res.send('<script>alert("Unauthorized access"); location.href = "/customer/login";</script>');
        }
    });
});

// Post route for registration page
app.post('/customer/register', (req, res) => {
    const { iam, fullname, username, email, password } = req.body;

    // Checking if email or username exists
    db.get('SELECT * FROM customers WHERE email = ? AND username = ?', [email, username], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (row) {
            const html = '<script>alert("Email or username already exists"); location.href = "/customer/register";</script>';
            return res.send(html);
        }

        // Insert data into the admns table
        const stmt = db.prepare("INSERT INTO customers (iam, fullname, username, email, password) VALUES (?, ?, ?, ?, ?)");
        stmt.run(iam, fullname, username, email, password, function(err) {
            if (err) {
                console.log(err.message);
                return res.send('Error occured during registration. Please try again');
            }
            console.log(`A row has been inserted with rowid ${this.lastID}`);
            const html1 = '<script>alert("Registration successful!"); location.href = "/customer/login";</script>'
            return res.send(html1);
        });
        stmt.finalize();
    });
});

// Post route for changing password page
app.post('/customer/change-password', checkIsAuthenticated, (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const username = req.session.username;

    // Logic to check if the provided current password matches with the one in the database
    db.get('SELECT password FROM customers WHERE username = ?', [username], (err, result) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (!result) {
            return res.send('<script>alert("User not found"); location.href = "/customer/change-password";</script>');
        }

    // Logic to validate the password
    if (newPassword !== confirmPassword) {
        return res.send('<script>alert("New password and confirm password do not match!!"); location.href="/customer/change-password";</script>');
    }

    // Logic to update password
    if (username) {
        db.run('UPDATE customers SET password = ? WHERE username = ?', [newPassword, username], function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Internal Server Error');
            }
            console.log(`Password has been updated for customer with id: ${username}`);
            res.send('<script>alert("Password changed successfully"); location.href="/customer/logout";</script>');
        });
    } else {
        res.status(401).send('<script>alert("Unauthorized"); location.href="/customer/change-password";</script>');
    }
});
});

// Post route for updating profile page
app.post('/customer/update-profile', checkIsAuthenticated, (req, res) => {
    const { fullname, email, username } = req.body;
    const customerUsername = req.session.username;

    // Check if fullname, email and username already exists in the database
    db.get('SELECT * FROM customers WHERE (fullname = ? OR email = ? OR username = ?) AND id = ?', [fullname, email, username, customerUsername], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (row) {
            console.log('Row exists:', row);
            if (row.fullname === fullname) {
                return res.status(400).send("<script>alert('Full name already exists'); location.href='/customer/update-profile';</script>");
            }
            if (row.email === email) {
                return res.status(400).send('<script>alert("Email already exists"); location.href="/customer/update-profile";</script>');
            }
            if (row.username === username) {
                return res.status(400).send('<script>alert("Username already exists"); location.href= "/customer/update-profile";</script>');
            }
        }

        // Update the profile in the database
        db.run('UPDATE customers SET fullname = ?, email = ?, username = ? WHERE id = ?', [fullname, email, username, customerUsername], function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Internal Server Error');
            }
            console.log(`Profile has been updated for customer with id: ${customerUsername}`);
            res.send('<script>alert("Profile update successfully"); location.href="/customer/dashboard";</script>');
        });
    });
});

// POST route for updating profile
app.post('/edituser',checkIsAuthenticated, (req, res) => {
    const { iam, fullname, username, email, password } = req.body;

    // Assuming you have a unique identifier for each user, such as an 'id'
    const loggedInUser = req.session.username; // Replace with the actual identifier you use for your users

    // Update the user details in the database
    const sql = 'UPDATE customers SET iam = ?, fullname = ?, username = ?, email = ?, password = ? WHERE username = ?';
    db.run(sql, [iam, fullname, username, email, password, loggedInUser], (err) => {
        if (err) {
            console.error('Error updating user:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.send(`<script>alert("Your details have been changed. Please login using your new credentials"); location.href = "/customer/login"; </script>`); // Redirect to the user details page after successful update
        }
    });
});

// Define storage for the images
const storage = diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads'); // Location where the file should be stored
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now()); // Generating a unique file name
    }
});

// Initialize multer upload with your storage configuration and fileFilter
const upload = multer({ storage: storage, fileFilter: fileFilter });

// Post route for uploading image
app.post('/uploadImage', upload.single('images'), (req, res) => {
    const file = req.file;

    // Read the file content and convert it to a Buffer
    const imageData = fs.readFileSync(file.path);  // Use 'fs' module here

    // Fetch the user's ID based on the username
    db.get('SELECT id FROM customers WHERE username = ?', [req.session.username], (err, row) => {
        if (err) {
            console.error('Error fetching user ID:', err);
            return res.status(500).send('Internal Server Error');
        }

        const userId = row.id;

        // Update the image data for the specific user
        const sql = 'UPDATE customers SET images = ? WHERE id = ?';
        db.run(sql, [imageData, userId], (err) => {
            if (err) {
                console.error('Error updating image:', err);
                return res.status(500).send('Internal Server Error');
            } else {
                console.log('Image upload was succeful');
                res.send(`<script>alert("You have uploaded your image successfully."); location.href = "/customer-details"; </script>`);
            }
        });
    });
});


// Post rout for contacting us
app.post('/contact-us', (req, res) => {
    const { name, email, Phone, message } = req.body;
  
  
    // Define the email options
    const mailOptions = {
      from: email,
      to: 'adisoncheruiyot55@gmail.com', // Replace with the company's email
      subject: 'Contact us queries',
      text: ` FROM\nName: ${name}\nEmail: ${email}\nPhone: ${Phone}\nMessage: ${message}`
    };
  
    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
      }
      res.send('<script>alert("Message sent successfully"); location.href="/contact-us";</script>');
    });
  });

// Function to generate a unique 6-digit code
const generateUniqueCode = () => {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    return code;
};


// Post route for booking cargo
app.post('/customer/book-cargo', checkIsAuthenticated, (req, res) => {
    try {

        let status = "Pending";

        const {
            sender_name,
            company1,
            pickup_address,
            sender_email,
            sender_number,
            receiver_name,
            company2,
            delivery_address,
            receiver_email,
            receiver_number,
            product_type,
            gender,
            size,
            package_type,
            cargo_size,
            cargo_weight,
            cargo_dimension,
            quantity,
            hazardous_material,
            shipment_method,
            service_level,
            from_county,
            to_county,
            departure_time,
            arrival_time,
        } = req.body;

        // Generate the unique code
        const uniqueCode = generateUniqueCode();

        // Begin the transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Insert data into cargo_booking table
            const cargoStmt = db.prepare(
                'INSERT INTO cargo_booking (sender_name, company1, pickup_address, sender_email, sender_number, receiver_name, company2, delivery_address, receiver_email, receiver_number, product_type, gender, size, package_type, cargo_size, cargo_weight, cargo_dimension, quantity, hazardous_material, shipment_method, service_level, from_county, to_county, departure_time, arrival_time, status, code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            cargoStmt.run(
                sender_name,
                company1,
                pickup_address,
                sender_email,
                sender_number,
                receiver_name,
                company2,
                delivery_address,
                receiver_email,
                receiver_number,
                product_type,
                gender,
                size,
                package_type,
                cargo_size,
                cargo_weight,
                cargo_dimension,
                quantity,
                hazardous_material,
                shipment_method,
                service_level,
                from_county,
                to_county,
                departure_time,
                arrival_time,
                status,
                uniqueCode,
                function (err, row) {
                    if (err) {
                        console.log(row, err);
                        db.run('ROLLBACK', () => {
                            res.send('Error occurred during booking');
                        });
                        cargoStmt.finalize();
                    } else {
                        console.log(`A row for cargo_booking table has been inserted with rowid ${this.lastID}`, row);

                        // Commit the transaction if the insert is successful
                        db.run('COMMIT', (err) => {
                            if (err) {
                                console.error(err.message);
                                db.run('ROLLBACK', () => {
                                    res.send('Error occurred during booking');
                                });
                            } else {
                                const html2 = `<script>alert("Booking successful. Your unique tracking code is ${uniqueCode}. Please copy and save it somewhere save!!"); location.href = "/order-confirm";</script>`;
                                res.send(html2);
                            }
                        });
                    }
                    cargoStmt.finalize();
                }
            );
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Post route for payment
app.post('/payment', checkIsAuthenticated, (req, res) => {
    const { card_name, card_number, card_month, card_year, card_cvc, amount } = req.body;
  
    // Inserting data into the database
    const stmt = db.prepare('INSERT INTO payment (card_name, card_number, card_month, card_year, card_cvc, amount) VALUES (?, ?, ?, ?, ?, ?)');
  
    stmt.run(card_name, card_number, card_month, card_year, card_cvc, amount, function (err) {
      if (err) {
        console.error(err.message);
        return res.status(500).send('Error occurred during payment');
      }
  
      console.log(`A row for payment table has been inserted with rowid ${this.lastID}`);
      // Send a success response to the client
      res.status(200).json({ message: 'Payment successful' });
    });
  
    stmt.finalize();
  });
  

// Post route for retrieving cargo tracking code
app.post('/retrieve-code', checkIsAuthenticated, (req, res) => {
    try {
        const email = 'adisoncheruiyot4@gmail.com';
        // Retrieve the unique code from the database
        db.all('SELECT code FROM cargo_booking WHERE receiver_email = ? ', [username], (err, rows) => {
            if (err) {
                console.error('Error retrieving the unique code from the database', err);
                return res.send('Error retrieving the unique code from the database');
            }

            // Assuming there's only one unique code in the database
            const uniqueCode = rows;

            const html = `<script>alert("Your Unique Tracking Code is: ${uniqueCode}. To track your cargo, use this code in the next page."); location.href="/track-cargo";</script>`;
            res.send(html);
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Post route for tracking cargo status
app.post('/track-cargo', (req, res) => {
    const { code } = req.body;
    try {
        // Retrieve the unique code from the database
        db.all('SELECT status FROM cargo_booking WHERE code = ?', [code], function(err, rows) {
            if (err) {
                console.error('Error retrieving the unique code from the database', err);
                return res.send('Error retrieving the unique code from the database');
            } else {
                if (rows && rows.length > 0) {
                    const status = rows[0].status; // Access the status from the first row
                    const html = `<script>alert("Your cargo status is ${status}"); location.href = "/track-cargo";</script>`;
                    res.send(html);
                } else {
                    res.send('Cargo not found');
                }
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Server port listening
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
