import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import morgan from 'morgan';
import allRoutes from "./routes/index.js"
config();

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5175', 'https://study-cafe-ymuj.onrender.com', 'https://study-cafe-admin.onrender.com'],
  credentials: true
}));

  
app.use(express.json());
app.use(morgan("dev"))

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
      const allowedOrigins = ['http://localhost:5173', 'http://localhost:5175', 'https://study-cafe-ymuj.onrender.com', 'https://study-cafe-admin.onrender.com'];
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes(origin)) {
          res.header("Access-Control-Allow-Origin", origin);
      }
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
      return res.sendStatus(200);
  }
  next();
});

app.use("/api", allRoutes)

app.get("/", (req,res)=>{
    res.send("Server Running!")
})


export default app;