import { Router } from "express";
import { adminLogin, logoutAdmin } from "../controllers/authController";
import { authorizeAdmin } from "../middlewares/authMiddleware";
import { blockUser, changeRole, getUsers } from "../controllers/admin/users";
import { freezWorkspace, getWorkspaces } from "../controllers/admin/workspace";
import {
  addNewSubscriptionPlan,
  disableSubscriptionPlan,
  editSubscriptionPlan,
  getSubscriptionPlans,
} from "../controllers/admin/subscriptions";
import { getDashboard } from "../controllers/admin/dashboard";
import {
  deleteProgram,
  editProgram,
  getProgram,
  getPrograms,
  updateProgramStatus,
} from "../controllers/admin/program";
import { removeProgramImage } from "../controllers/user/profile";

const router = Router();

router.post("/login", adminLogin);
router.get("/users", authorizeAdmin, getUsers);
router.post("/users/:userId/block", authorizeAdmin, blockUser);
router.post("/users/:userId/role", authorizeAdmin, changeRole);
router.post("/logout", authorizeAdmin, logoutAdmin);

router.get("/dashboard", authorizeAdmin, getDashboard);

router.get("/workspaces", authorizeAdmin, getWorkspaces);
router.post("/workspaces/:workspaceId/freez", authorizeAdmin, freezWorkspace);

router
  .route("/subscription-plans")
  .get(authorizeAdmin, getSubscriptionPlans)
  .post(authorizeAdmin, addNewSubscriptionPlan);
router.patch("/subscription-plans/:planId/disable", disableSubscriptionPlan);
router.put("/subscription-plans/:planId", editSubscriptionPlan);

router.get("/programs", authorizeAdmin, getPrograms);
router
  .route("/programs/:programId")
  .get(authorizeAdmin, getProgram)
  .put(authorizeAdmin, editProgram)
  .delete(authorizeAdmin, deleteProgram);
router.post("/programs/:programId/status", authorizeAdmin, updateProgramStatus);
router.delete(
  "/programs/:programId/images/:imageKey",
  authorizeAdmin,
  removeProgramImage
);

export default router;
