import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import morgan from 'morgan';
import allRoutes from "./routes/index.js";
config();

const app = express();

// 🔹 Allowed Frontend URLs
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5175',
  'https://study-cafe-ymuj.onrender.com',
  'https://study-cafe-admin.onrender.com',
  'https://bannerbuddy.digitalnightowl.agency',
  'https://bannerbuddy.in',
  'https://sportslivv-chbb.onrender.com',
  'https://jolly-crisp-339143.netlify.app' // ✅ New permission added
];

// 🔹 CORS middleware (all requests)
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(morgan("dev"));

// 🔹 API Routes
app.use("/api", allRoutes);

// 🔹 Default route
app.get("/", (req,res)=>{
    res.send("Server Running!");
});

export default app;








