import express from 'express'
import cors from 'cors'
import bcrypt, { setRandomFallback }from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const app =  express()
app.use(cors())
// app.options("*", cors);
app.use(express.json())
const prisma = new PrismaClient()

const port = 4000
const SECRET = process.env.SECRET!

function generateToken(id: number) {
  return jwt.sign({ id: id }, SECRET, { expiresIn: "2 days" });
}

app.listen(port, () => {
    console.log(`Click: http://localhost:${port}`)
})