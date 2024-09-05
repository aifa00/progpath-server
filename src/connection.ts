import { connect } from "mongoose";
import logger from "./utils/logger";

const connection = async () => {
  try {
    await connect(process.env.MONGODB_URL as string);
  } catch (error) {
    logger.error(error);
  }
};

export default connection;
