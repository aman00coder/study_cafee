import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import morgan from 'morgan';
import allRoutes from "./routes/index.js"
config();

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
app.use(express.json());
app.use(morgan("dev"))

app.use("/api", allRoutes)

app.get("/", (req,res)=>{
    res.send("Server Running!")
})


export default app;