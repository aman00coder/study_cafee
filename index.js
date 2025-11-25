// index.js

import dotenv from "dotenv";        // dotenv import
dotenv.config();                    // .env load

import { connect } from "./src/connections/connection.js";
import app from "./src/app.js";

// PORT environment variable properly read, aur sab IPs pe listen kar raha
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';  // public IP access ke liye

connect()
.then(() => {
    app.listen(PORT, HOST, () => {
        console.log(`Server is running on ${HOST}:${PORT}`);
        console.log('Mongo URI:', process.env.MONGO_URI); // check if env loaded
    });
})
.catch((error) => {         
    console.error('Error starting server:', error);
});
