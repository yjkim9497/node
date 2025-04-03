import express from "express";
import {
  getAllPosts,
  getSinglePost,
  createPost,
  updateExistingPost,
  deleteExistingPost,
} from "../controllers/postController";

const router = express.Router();

router.get("/posts", getAllPosts);
router.get("/posts/:id", getSinglePost);
router.post("/posts", createPost);
router.put("/posts/:id", updateExistingPost);
router.delete("/posts/:id", deleteExistingPost);

export default router;
