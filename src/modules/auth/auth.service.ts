import axios from "axios";
import jwt from "jsonwebtoken";
import { PrismaClient, User, Provider } from "../../generated/prisma/client.js";
import { comparePassword, hashPassword } from "../../lib/argon.js";
import { UserInfo } from "../../types/google.js";
import { ApiError } from "../../utils/api-error.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { LoginDTO } from "./dto/login.dto.js";
import { GoogleDTO } from "./dto/google.dto.js";
import { MailService } from "../mail/mail.service.js";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto.js";

export class AuthService {
  constructor(private prisma: PrismaClient, private mailService: MailService) { }

  register = async (body: RegisterDTO) => {
    //1. cek dulu emailnya udah kepake apa belum
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email,
      },
    });

    //2. kalo udah kepake throw error
    if (user) {
      throw new ApiError("Email already exist", 400);
    }

    //3. kalo belum, create data yser baru berdasarkan request body
    const hashedPassword = await hashPassword(body.password);

    //4. kalo belum, create data yser baru berdasarkan request body
    await this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
      },
    });

    // 5. send email
    this.mailService.sendEmail
      (body.email, `welcome, ${body.name}`, "welcome", { name: body.name });

    //6. return message register success
    return { message: "Register success" };
  };
  login = async (body: LoginDTO) => {
    // 1.cek emailny ada di db atau enggak
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email,
      },
    });
    // 2.kalo enggak ada, throw error
    if (!user) {
      throw new ApiError("Invalid credentials", 400);
    }
    // 3.cek passwordnya benar atau tidak
    const isPassMatch = await comparePassword(user.password, body.password);
    // 4.kalo enggak benar, throw error
    if (!isPassMatch) {
      throw new ApiError("Invalid credentials", 400);
    }
    // 5.generate jwt token ->jsonwebtoken
    const payload = {
      id: user.id,
      role: user.role,
    };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    });
    // buat refresh token
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET_REFRESH!, {
      expiresIn: "3d",
    });

    await this.prisma.refreshToken.upsert({
      where: { userId: user.id },
      update: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      create: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    })

    // 6.return user data + token
    const { password, ...userWithoutPassword } = user; // remove property password
    return {
      ...userWithoutPassword,
      accessToken,
      refreshToken,
    };
  };

  logout = async (refreshToken?: string) => {
    if (!refreshToken) return;

    await this.prisma.refreshToken.deleteMany({
      where: {
        token: refreshToken
      }
    });

    return { message: "Logout success" };
  }
  google = async (body: GoogleDTO) => {
    // ===== helpers =====
    const signAccessToken = (user: { id: number; role: string }) =>
      jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: "15m" });

    const signRefreshToken = (user: { id: number; role: string }) =>
      jwt.sign(user, process.env.JWT_SECRET_REFRESH!, { expiresIn: "3d" });

    const sanitizeUser = <T extends { password?: string }>(user: T) => {
      const { password, ...rest } = user;
      return rest;
    };

    const refreshExpiredAt = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    );

    // ===== get google user info =====
    const { data } = await axios.get<UserInfo>(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${body.accessToken}`,
        },
      },
    );

    // ===== find user =====
    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    // ===== create user if not exists =====
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: "",
          Provider: Provider.GOOGLE,
        },
      });
    }

    // ===== provider mismatch =====
    if (user.Provider !== Provider.GOOGLE) {
      throw new ApiError("Account already registered without google", 400);
    }

    // ===== generate tokens =====
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // ===== upsert refresh token =====
    await this.prisma.refreshToken.upsert({
      where: { userId: user.id },
      update: {
        token: refreshToken,
        expiresAt: refreshExpiredAt,
      },
      create: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshExpiredAt,
      },
    });

    return {
      ...sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  };
  refresh = async (refreshToken?: string) => {
    if (!refreshToken) throw new ApiError("Refresh token is required", 400);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!stored) throw new ApiError("Invalid refresh token", 400);

    const isExpired = stored.expiresAt < new Date();
    if (isExpired) throw new ApiError("Refresh token expired", 400);

    const payload = {
      id: stored.user.id,
      role: stored.user.role,
    };
    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    });
    return {
      accessToken: newAccessToken,
    };
  }
  forgotPassword = async (body: ForgotPasswordDTO) => {
    // 1. cek email ada di db atau enggak
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email,
      },
    });
    // 2. kalo enggak ada, return success
    if (!user) return { message: "send email success" };
    // 3. generate token random
    const payload = {
      id: user.id,
      role: user.role,
    };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "15m",
    });
    // 4. Kirim email reset password + token
    this.mailService.sendEmail(
      user.email, 
      "forgot password", 
      "Reset password",
    {link: `http://localhost:5173/reset-password/${accessToken}`});
    // 5. return success
    return { message: "send email success"};
  };
}
