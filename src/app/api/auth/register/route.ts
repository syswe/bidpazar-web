import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateVerificationCode, sendVerificationCode } from "@/lib/sms";
import { logger } from "@/lib/logger";
import { APP_VERSION } from "@/lib/auth";
import jwt from "jsonwebtoken";

const registerSchema = z.object({
  email: z
    .string()
    .email(
      "Geçersiz e-posta adresi. Lütfen geçerli bir e-posta adresi giriniz (örn: user@example.com)"
    )
    .refine(
      (email) => {
        // Additional email validation to ensure domain has at least 2 chars (.com, .org, etc)
        const parts = email.split("@");
        if (parts.length !== 2) return false;

        const domain = parts[1];
        const domainParts = domain.split(".");

        return (
          domainParts.length >= 2 &&
          domainParts[domainParts.length - 1].length >= 2
        );
      },
      {
        message:
          "E-posta adresi geçerli bir domain içermelidir (örn: example.com)",
      }
    ),
  username: z.string().min(3, "Kullanıcı adı en az 3 karakter olmalıdır"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export async function POST(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  logger.info("API POST /api/auth/register", { headers, body });
  try {
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username },
          ...(validatedData.phoneNumber
            ? [{ phoneNumber: validatedData.phoneNumber }]
            : []),
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "User with this email, username, or phone number already exists",
        },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Generate verification code if phone number is provided
    let verificationCode = null;
    let verificationRequired = false;
    let smsSent = false;

    if (validatedData.phoneNumber) {
      verificationCode = generateVerificationCode();
      verificationRequired = true;

      // Log phone number before sending
      logger.info(
        `Attempting to send verification SMS to ${validatedData.phoneNumber}`,
        {
          phoneNumber: validatedData.phoneNumber,
          code: verificationCode,
          environment: process.env.NODE_ENV,
          sendMessageMode: process.env.SEND_MESSAGE || "undefined",
        }
      );

      try {
        smsSent = await sendVerificationCode(
          validatedData.phoneNumber,
          verificationCode
        );
        logger.info(`SMS sending result: ${smsSent ? "success" : "failed"}`);
      } catch (smsError) {
        logger.error("Error sending SMS during registration", {
          error: smsError,
          phoneNumber: validatedData.phoneNumber,
        });

        // Don't block registration if SMS fails in production - we'll create the user
        // but will need to handle verification differently
        smsSent = false;
      }

      // If SMS failed and we're in production, log a specific error
      if (!smsSent && process.env.NODE_ENV === "production") {
        logger.error("SMS verification failed in production", {
          phoneNumber: validatedData.phoneNumber,
          smsApiUrl: process.env.SMS_API_URL,
          smsOrigin: process.env.SMS_ORIGIN,
          // Don't log password or actual credentials
          smsUsernameSet: !!process.env.SMS_USERNAME,
          smsPasswordSet: !!process.env.SMS_PASSWORD,
        });
      }
    }

    // Create user (with or without verification code)
    // If SMS sending failed but we have a phone number, we still require verification
    // but will need to handle it differently (resend option is important)
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        password: hashedPassword,
        name: validatedData.name,
        phoneNumber: validatedData.phoneNumber,
        verificationCode,
        isVerified: !verificationRequired, // If no phone number, mark as verified
      },
    });

    // Remove sensitive data from response
    const { password, verificationCode: _, ...userWithoutSensitiveInfo } = user;

    let token = null;
    if (!verificationRequired) {
      // Auto-verified, issue JWT
      token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin ?? false,
          appVersion: APP_VERSION,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
      );
    }

    // Create the response
    const response = NextResponse.json(
      {
        message: verificationRequired
          ? "User created successfully. Please verify your phone number."
          : "User created successfully.",
        user: userWithoutSensitiveInfo,
        requireVerification: verificationRequired,
        smsSent: smsSent, // Add SMS status to help client
        ...(token ? { token } : {}),
      },
      { status: 201 }
    );

    // If we generated a token (user does not need verification),
    // set cookies for automatic login
    if (token) {
      // Set both token and authToken cookies for compatibility
      response.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      // Set authToken cookie (used by middleware)
      response.cookies.set("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      logger.info("Registration successful, auto-login with tokens set", {
        userId: user.id,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid input data in register", error);
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }
    logger.error("Registration error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
