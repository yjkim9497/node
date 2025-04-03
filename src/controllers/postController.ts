import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 📌 모든 게시글 조회
export const getAllPosts = async (req: Request, res: Response) => {
  const posts = await prisma.post.findMany();
  res.json(posts);
};

// 📌 특정 게시글 조회
export const getSinglePost = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = Number(req.params.id);
  
      if (isNaN(postId)) {
        res.status(400).json({ message: "유효한 게시글 ID를 입력하세요." });
        return;
      }
  
      const post = await prisma.post.findUnique({ where: { id: postId } });
  
      if (!post) {
        res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
        return;
      }
  
      res.json(post);
    } catch (error) {
      console.error("게시글 조회 오류:", error);
      res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
    }
  };
  
  
  // 📌 게시글 생성
  export const createPost: (req: Request, res: Response) => Promise<void> = async (req, res) => {
    try {
      const { title, content } = req.body;
  
      if (!title || !content) {
        res.status(400).json({ message: "제목과 내용을 입력해주세요." });
        return;
      }
  
      const newPost = await prisma.post.create({ data: { title, content } });
  
      res.status(201).json(newPost);
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "게시글 생성 중 오류가 발생했습니다." });
      return;
    }
  };

// 📌 게시글 수정
export const updateExistingPost = async (req: Request, res: Response) => {
  const updatedPost = await prisma.post.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  res.json(updatedPost);
};

// 📌 게시글 삭제
export const deleteExistingPost = async (req: Request, res: Response) => {
  await prisma.post.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: "게시글이 삭제되었습니다." });
};
