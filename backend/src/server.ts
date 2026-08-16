import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(
    cors({
        origin: "http://localhost:5174",
        credentials: true,
    })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        message: "COLLABSPHERE backend is running",
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`COLLABSPHERE backend running on http://localhost:${PORT}`);
});