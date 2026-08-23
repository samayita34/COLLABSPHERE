import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import projectRoutes from "./routes/projectRoutes";

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

app.use("/api/projects", projectRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`COLLABSPHERE backend running on http://localhost:${PORT}`);
});