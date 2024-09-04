import { Router } from "express";
import {
  facebookLogin,
  forgotPassword,
  googleLogin,
  loginUser,
  logoutUser,
  registerUser,
  resendOtp,
  resetPassword,
  setRole,
  verifyOtp,
} from "../controllers/authController";
import { getHome } from "../controllers/user/home";
import { authorizeUser, isLoggedIn } from "../middlewares/authMiddleware";
import {
  addWorkspace,
  cancelInvitation,
  deleteWorkspace,
  editWorkspace,
  getInvitationsSend,
  getSingleWorkspace,
  getWorkspace,
  invitationAction,
  removeCollaborator,
  sendInvitations,
} from "../controllers/user/workspace";
import {
  addNewProject,
  deleteProject,
  editProject,
  getBurnoutData,
  getProject,
  getTasks,
  starProject,
} from "../controllers/user/project";
import {
  authorizeTeamlead,
  isTeamlead,
} from "../middlewares/workspaceMiddlewares";
import {
  addNewTask,
  deleteAttachment,
  deleteTask,
  editTask,
  getTask,
  updatePriority,
  updateStatus,
  uploadAttachments,
} from "../controllers/user/task";
import { upload } from "../middlewares/multerMiddleware";
import {
  addProgramImage,
  changeEmail,
  changePassword,
  deleteProfileImage,
  getProfile,
  getProgram,
  getUploadedPrograms,
  removeProgramImage,
  updateProfile,
  uploadProfileImage,
} from "../controllers/user/profile";
import {
  addSubscription,
  getPremiumPage,
  subscribe,
  subscribeToTrial,
} from "../controllers/user/subscription";
import {
  addNewProgram,
  deleteProgram,
  editProgram,
  getMarketplace,
  getSingleProgram,
} from "../controllers/user/marketplace";
import {
  processImages,
  processProfileImage,
} from "../middlewares/sharpMiddleware";
import {
  addLike,
  deleteComment,
  editComment,
  getComments,
  getReplies,
  postComment,
  removeLike,
  replyComment,
} from "../controllers/user/commentsAndLikes";
import {
  processPrompt,
  summarizeContent,
} from "../controllers/user/geminiApiController";
import {
  accessChat,
  allMessages,
  AllUsers,
  deleteMessage,
  fetchChats,
  sendMessage,
} from "../controllers/user/chat";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/login/google", googleLogin);
router.post("/login/facebook", facebookLogin);
router.post("/login/role", authorizeUser, setRole);
router.post("/login/forgot-password", forgotPassword);
router.post("/login/reset-password", resetPassword);
router.post("/otp/verification", verifyOtp);
router.post("/otp/resend", resendOtp);
router.get("/auth/user", isLoggedIn);
router.get("/", authorizeUser, getHome);
router.post("/logout", authorizeUser, logoutUser);

router
  .route("/workspaces")
  .get(authorizeUser, getWorkspace)
  .post(authorizeUser, isTeamlead, addWorkspace);

router.post("/workspaces/invitations/action", authorizeUser, invitationAction);

router
  .route("/workspaces/:workspaceId")
  .get(authorizeUser, getSingleWorkspace)
  .patch(authorizeUser, isTeamlead, authorizeTeamlead, editWorkspace)
  .delete(authorizeUser, isTeamlead, authorizeTeamlead, deleteWorkspace);

router
  .route("/workspaces/:workspaceId/invitations")
  .get(authorizeUser, getInvitationsSend)
  .post(authorizeUser, isTeamlead, authorizeTeamlead, sendInvitations);

router.delete(
  "/workspaces/:workspaceId/invitations/:invitationId",
  authorizeUser,
  authorizeTeamlead,
  cancelInvitation
);
router.patch(
  "/workspaces/:workspaceId/collaborators/:collaboratorId",
  authorizeUser,
  authorizeTeamlead,
  removeCollaborator
);

router.post(
  "/workspaces/:workspaceId/projects",
  authorizeUser,
  authorizeTeamlead,
  addNewProject
);
router
  .route("/workspaces/:workspaceId/projects/:projectId")
  .get(authorizeUser, getProject)
  .patch(authorizeUser, authorizeTeamlead, editProject)
  .delete(authorizeUser, authorizeTeamlead, deleteProject);
router.post(
  "/workspaces/:workspaceId/projects/:projectId/star",
  authorizeUser,
  starProject
);
router.get(
  "/workspaces/:workspaceId/projects/:projectId/burn-out-graph",
  authorizeUser,
  getBurnoutData
);

router
  .route("/workspaces/:workspaceId/projects/:projectId/tasks")
  .get(authorizeUser, getTasks)
  .post(authorizeUser, authorizeTeamlead, upload.array("files"), addNewTask);

router
  .route("/workspaces/:workspaceId/projects/:projectId/tasks/:taskId")
  .get(authorizeUser, getTask)
  .put(authorizeUser, editTask)
  .delete(authorizeUser, authorizeTeamlead, deleteTask);

router
  .route(
    "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments"
  )
  .post(authorizeUser, upload.array("files"), uploadAttachments);

router.delete(
  "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments/:attachmentKey",
  authorizeUser,
  deleteAttachment
);

router.patch(
  "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/status",
  authorizeUser,
  updateStatus
);

router.patch(
  "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/priority",
  authorizeUser,
  updatePriority
);

router
  .route("/profile")
  .get(authorizeUser, getProfile)
  .patch(authorizeUser, updateProfile);
router.post("/profile/email", authorizeUser, changeEmail);
router
  .route("/profile/image")
  .post(
    upload.single("image"),
    processProfileImage,
    authorizeUser,
    uploadProfileImage
  )
  .delete(authorizeUser, deleteProfileImage);
router.patch("/profile/password", authorizeUser, changePassword);
router.get("/profile/programs", authorizeUser, getUploadedPrograms);
router.get("/profile/programs/:programId", authorizeUser, getProgram);
router.post(
  "/profile/programs/:programId/images",
  upload.array("images"),
  authorizeUser,
  addProgramImage
);
router.delete(
  "/profile/programs/:programId/images/:imageKey",
  authorizeUser,
  removeProgramImage
);

router.post("/comments", authorizeUser, postComment);
router.get("/comments/:referenceId", authorizeUser, getComments);
router
  .route("/comments/:commentId")
  .patch(authorizeUser, editComment)
  .delete(authorizeUser, deleteComment);
router.post("/likes", authorizeUser, addLike);
router.delete("/likes/:referenceId", authorizeUser, removeLike);

router
  .route("/comments/:parentCommentId/replies")
  .get(authorizeUser, getReplies)
  .post(authorizeUser, replyComment);

router.get("/premium", authorizeUser, getPremiumPage);
router.post("/subscribe", authorizeUser, subscribe);
router.post("/subscribe/trial", authorizeUser, subscribeToTrial);
router.post("/razorpay-payment-verification", authorizeUser, addSubscription);

router
  .route("/marketplace")
  .get(authorizeUser, getMarketplace)
  .post(upload.array("images"), processImages, authorizeUser, addNewProgram);
router
  .route("/marketplace/:programId")
  .get(authorizeUser, getSingleProgram)
  .put(authorizeUser, editProgram)
  .delete(authorizeUser, deleteProgram);

router.post("/gemini/prompt", authorizeUser, processPrompt);
router.post("/gemini/prompt/summarize", authorizeUser, summarizeContent);

router.post("/chat/users", authorizeUser, AllUsers);
router.get("/chat/my-chats", authorizeUser, fetchChats);
router.get("/chat/users/:user_id", authorizeUser, accessChat);
router
  .route("/chat/:chatId/messages")
  .get(authorizeUser, allMessages)
  .post(authorizeUser, sendMessage);
router.delete("/chat/messages/:messageId", authorizeUser, deleteMessage);

export default router;
