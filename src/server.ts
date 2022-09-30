import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { PrismaClient, User } from "@prisma/client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { Server } from "socket.io";
dotenv.config();

const app = express();
app.use(cors());
// app.options('*', cors());
app.use(express.json());
const prisma = new PrismaClient();

const port = 5000;
const SECRET = process.env.SECRET!;

function generateToken(id: number) {
  return jwt.sign({ id: id }, SECRET, { expiresIn: "30 days" });
}

//Getting all the users and their messages includng the rooms
app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { messages: true, rooms: true, participants: true },
    });
    res.send(users);
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});
app.delete("/user/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deletedUser = await prisma.user.delete({
      where: { id },
      include: { messages: true, participants: true, rooms: true }
    });
    if (deletedUser) {
      res.send({ message: "user deleted" });
    } else {
      res.status(404).send({ error: "User not found" });
    }
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});
//getting a single user
app.get("/user/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { messages: true, rooms: true, participants: true },
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

async function getCurrentUser(token: string) {
  const decodedData = jwt.verify(token, SECRET);
  const user = await prisma.user.findUnique({
    // @ts-ignore
    where: { id: decodedData.id },
    include: {
      messages: true,
      rooms: { include: { User: true, messages: true, participants: true } },
      participants: true,
    },
  });
  return user;
}

// res.send({ user: user, token: generateToken(user.id) })

//creating a new user account
app.post("/sign-up", async (req, res) => {
  const { email, password } = req.body;

  try {
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

//Giving accsess to the user into his account
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
      res.status(404).send({ errors });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (user && bcrypt.compareSync(password, user.password)) {
      // const token = generateToken(user.id);
      res.send({ user, token: generateToken(user.id) });
    } else {
      res.status(404).send({ errors: ["Username/password invalid."] });
    }
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

//Getting all the messages
app.get("/messages", async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      include: { room: true, sender: true },
    });
    res.send(messages);
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});

//Creating a new message
app.post("/messages", async (req, res) => {
  try {
    const roomId = Number(req.body.roomId);
    const userId = Number(req.body.userId);
    const newMessage = await prisma.message.create({
      data: {
        content: req.body.content,
        roomId: roomId,
        userId: userId,
      },
    });
    res.send(newMessage);
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});
// data: {
//   content: req.body.content,
//   room: {
//     connectOrCreate: {
//       where: { id: roomId },
//       create: {
//         participants: { connect: { id: participantId } },
//         User: { connect: { email: req.body.email } },
//       },
//     },
//   },
//   sender: { connect: { email: req.body.email } },
// },
// });
//Deleting a message
app.delete("/messages/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deletedMessage = await prisma.message.delete({ where: { id } });
    if (deletedMessage) {
      res.send({ message: "Message deleted" });
    } else {
      res.status(404).send({ error: "Message not found" });
    }
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});

app.get("/rooms", async (req, res) => {
  try {
    const user = await getCurrentUser(req.headers.authorization!);
    if (user) {
      res.send(user.rooms);
    } else {
      res.status(400).send({ error: "You have no authorization!" });
    }
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});

//get a specific conversation
app.get("/rooms/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const room = await prisma.room.findUnique({ where: { id } , include: {messages: true}});
    if (room) {
      res.send(room);
    } else {
      res.send({ error: "Room not found" });
    }
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

//creating a conversation
app.post("/rooms", async (req, res) => {
  try {
    const messageId = Number(req.body.roomId);
    const participantId = Number(req.body.participantId);

    const room = await prisma.room.create({
      data: {
        User: { connect: { email: req.body.email } },
        messages: {
          connectOrCreate: {
            where: { id: messageId },
            create: {
              content: req.body.content,
              sender: { connect: { email: req.body.email } },
            },
          },
        },
        participants: { connect: { id: participantId } },
      },
    });
    res.send(room);
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ errors: [error.message] });
  }
});

//Delete a full conversation
app.delete("/rooms/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deletedRoom = await prisma.room.delete({ where: { id } });
    if (deletedRoom) {
      res.send({ message: "Conversation deleted" });
    } else {
      res.status(404).send({ error: "Conversation not found" });
    }
  } catch (error) {
    //@ts-ignore
    res.status(400).send({ error: error.message });
  }
});

app.get("/validate", async (req, res) => {
  try {
    if (req.headers.authorization) {
      const user = await getCurrentUser(req.headers.authorization);
      // @ts-ignore
      res.send({ user, token: generateToken(user.id) });
    }
  } catch (error) {
    // @ts-ignore
    res.status(400).send({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Click: http://localhost:${port}`);
});

const io = new Server(4555, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const messages: Message[] = [];

type Message = {
  content: string;
  user: User & { friends: User[] };
};
//initializing the socket io connection
io.on("connection", (socket) => {
  //for a new user joining the chat
  socket.emit("message", messages);
  socket.on("message", (message: Message) => {
    messages.push(message);
    socket.broadcast.emit("message", messages);
  });
});
