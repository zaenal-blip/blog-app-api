import { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { CreateBlogDTO } from "./dto/create-blog.dto.js";
import { generateSlug } from "./dto/generate-slug.js";
import { GetBlogsDto } from "./dto/get-blogs.dto.js";
export class BlogService {
    constructor(private prisma: PrismaClient,
        private cloudinaryService: CloudinaryService
    ) { }
    getBlogs = async (query: GetBlogsDto) => {
        const { page, take, sortBy, sortOrder, search } = query;
        const whereClause: Prisma.BlogWhereInput = {};
        if (search) {
            whereClause.title = { contains: search, mode: "insensitive" };
        }
        const blogs = await this.prisma.blog.findMany({
            where: whereClause,
            take: take,
            skip: (page - 1) * take,
            orderBy: { [sortBy as any]: sortOrder as any },
            include: {
                user: {
                    select: {
                        name: true
                    },
                },
            },
        });
        const total = await this.prisma.blog.count({ where: whereClause });
        return {
            data: blogs,
            meta: { page, take, total },
        };
    };
    createBlog = async (body: CreateBlogDTO, thumbnail: Express.Multer.File, userId: number) => {
        const { title } = body;

        // 1.cari dulu blog berdasarkan title udah ada apa belom
        const existingBlog = await this.prisma.blog.findFirst({
            where: { title: title },
        });

        // 2.jika blog udah ada, throw error
        if (existingBlog) throw new Error("Blog already exists");

        // 3.jika blog belum ada, create blog berdasarkan title
        const slug = generateSlug(title);

        // 4.upload thumbnail ke cloudinary
        const { secure_url } = await this.cloudinaryService.upload(thumbnail);

        // 5.create blog berdasarkan body, secure url, dan user id
        const blog = await this.prisma.blog.create({
            data: {
                ...body,
                slug,
                thumbnail: secure_url,
                userId: userId,
            },
        });
        return blog;
    };
    getBlogBySlug = async (slug: string) => {
        const blog = await this.prisma.blog.findUnique({
            where: { slug: slug },
            include: {
                user: {
                    select: {
                        name: true
                    },
                },
            },
        });
        if (!blog) throw new Error("Blog not found");

        return blog;
    };
}