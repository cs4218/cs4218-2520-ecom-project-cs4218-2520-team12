import express from "express";
import cors from "cors";
import morgan from "morgan";
import colors from "colors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoute.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";

// configure env
dotenv.config();

// database config
connectDB();

const app = express();

// middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/category", categoryRoutes);
app.use("/api/v1/product", productRoutes);

// rest api
app.get("/", (req, res) => {
    res.send("<h1>Welcome to ecommerce app</h1>");
});

if (process.env.NODE_ENV !== "test") {
    const PORT = process.env.PORT || 6060;

    app.listen(PORT, () => {
        console.log(
            `Server running on ${process.env.DEV_MODE} mode on ${PORT}`.bgCyan.white,
        );
    });
}

export default app;
