// index.js

import dotenv from "dotenv";        // dotenv import
dotenv.config();                    // .env load

import { connect } from "./src/connections/connection.js";
import app from "./src/app.js";

// Ab PORT environment variable properly read hoga
const PORT = process.env.PORT || 5000;

connect()
.then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log('Mongo URI:', process.env.MONGO_URI); // check if env loaded
    });
})
.catch((error) => {         
    console.error('Error starting server:', error);
});
