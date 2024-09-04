import express, { Express } from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import logger from "./utils/logger";
import connection from "./connection";
import userRoutes from "./routes/userRoutes";
import adminRoutes from "./routes/adminRoutes";
import errorHandler from "./middlewares/errorHandlerMiddleware";
import handleSocketIO from "./sockets/socketHandler";

const app: Express = express();
const PORT = process.env.PORT || 4001;

// middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// database connection
connection();

app.use("/", userRoutes);
app.use("/admin", adminRoutes);

app.use(errorHandler);

// start server
const server = app.listen(PORT, () => {
  logger.info(`Server is running at http://localhost:${PORT}`);
});

// Handle Socket.io
handleSocketIO(server);
