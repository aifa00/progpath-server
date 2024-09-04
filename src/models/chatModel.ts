import { Schema, model } from "mongoose";

const chatSchema = new Schema({
  chatName: {
    type: String,
  },
  users: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  latestMessage: {
    type: Schema.Types.ObjectId,
    ref: "Message",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Chat = model("Chat", chatSchema);

export default Chat;
