import { connect } from "./src/connections/connection.js";
import app from "./src/app.js";


const PORT = process.env.PORT || 5000
connect()
.then(()=>{
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((error) => {         
    console.error('Error starting server:', error);
})