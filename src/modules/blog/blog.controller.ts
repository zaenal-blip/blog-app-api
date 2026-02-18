import { plainToInstance } from "class-transformer";
import { BlogService } from "./blog.service.js";
import { GetBlogsDto } from "./dto/get-blogs.dto.js";
import { Request, Response } from "express";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { ApiError } from "../../utils/api-error.js";

export class BlogController {
    constructor(private blogService: BlogService, private cloudinaryService: CloudinaryService) { }

    getBlogs = async (req: Request, res: Response) => {
        const query = plainToInstance(GetBlogsDto, req.query);
        const result = await this.blogService.getBlogs(query);
        res.status(200).send(result);
    };

    createBlog = async (req: Request, res: Response) => {
        try {
            const user = res.locals.user;
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            const thumbnail = files.thumbnail?.[0];

            if (!thumbnail) throw new ApiError("Thumbnail file is required", 400);

            const blog = await this.blogService.createBlog(req.body, thumbnail, user.id);
            res.status(201).json(blog);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            res.status(400).json({ error: errMsg });
        }
    };

    uploadThumbnail = async (req: Request, res: Response) => {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const thumbnail = files.thumbnail?.[0];
        if (!thumbnail) throw new ApiError("Thumbnail file is required", 400);

        const result = await this.cloudinaryService.upload(thumbnail);
        res.status(200).send({
            fileURL: result.secure_url,
            filePath: result.public_id,
        });
    };
    getBlogBySlug = async (req: Request, res: Response) => {
        const { slug } = req.params;
        const blog = await this.blogService.getBlogBySlug(slug);
        res.status(200).send(blog);
    };
}