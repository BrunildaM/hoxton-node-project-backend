import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import jwt, { verify } from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
// app.options("*", cors);
app.use(express.json());
const prisma = new PrismaClient();

const port = 4000;
const SECRET = process.env.SECRET!;

function generateToken(id: number) {
  return jwt.sign({ id: id }, SECRET, { expiresIn: "1 month" });
}

app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { messages: true },
    });
    res.send(users);
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});

app.get("/user/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { messages: true, rooms: true },
    });
    if (user) {
      res.send(user);
    } else {
      res.status(404).send({ error: "User not found!" });
    }
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});

app.post("/sign-up", async (req, res) => {
  const { email, password } = req.body;

  try {
    //@ts-ignore
    const existingUser = await prisma.user.findUnique({ where: { email } });

    const errors: string[] = [];

    if (typeof email !== "string") {
      errors.push("Email missing or not a string");
    }

    if (typeof password !== "string") {
      errors.push("Password missing or not a string");
    }

    if (errors.length > 0) {
      res.status(400).send({ errors });
      return;
    }

    if (existingUser) {
      res.status(400).send({ errors: ["Email already exists."] });
      return;
    }

    const user = await prisma.user.create({
      //@ts-ignore
      data: {
        email,
        password: bcrypt.hashSync(password),
        avatar: req.body.avatar,
        lastName: req.body.lastName,
        firstName: req.body.firstName,
      },
    });
    const token = generateToken(user.id);
    res.send({ user, token });
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

app.post("/sign-in", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const errors: string[] = [];

    if (typeof email !== "string") {
      errors.push("Email missing or not a string");
    }

    if (typeof password !== "string") {
      errors.push("Password missing or not a string");
    }

    if (errors.length > 0) {
      res.status(400).send({ errors });
      return;
    }

    const user = await prisma.user.findUnique({
      //@ts-ignore
      where: { email },
    });
    if (user && verify(password, user.password)) {
      const token = generateToken(user.id);
      res.send({ user, token });
    } else {
      res.status(400).send({ errors: ["Username/password invalid."] });
    }
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

app.listen(port, () => {
  console.log(`Click: http://localhost:${port}`);
});
